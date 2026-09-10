use std::{env, fs, os::unix::fs::PermissionsExt, path::PathBuf, process::Command};
use sha2::{Digest, Sha256};

#[tauri::command]
async fn install_update(asset_url: String, version: String, expected_sha256: String) -> Result<(), String> {
    if version.len()>32 || !version.chars().all(|c| c.is_ascii_alphanumeric()||".-_".contains(c)){return Err("invalid version".into())}
    if !asset_url.starts_with("https://"){return Err("invalid update URL".into())}
    if expected_sha256.len()!=64 || !expected_sha256.chars().all(|c| c.is_ascii_hexdigit()){return Err("invalid update digest".into())}

    let target=env::var_os("APPIMAGE").map(PathBuf::from).unwrap_or(env::current_exe().map_err(|e|e.to_string())?);
    let parent=target.parent().ok_or("invalid executable path")?.to_path_buf();
    let temp=parent.join(format!(".kz-erp-update-{}.AppImage",version));
    let response=reqwest::get(&asset_url).await.map_err(|e|format!("download: {e}"))?;
    if !response.status().is_success(){return Err(format!("download HTTP {}",response.status()))}
    let bytes=response.bytes().await.map_err(|e|format!("read download: {e}"))?;
    if bytes.len()<1024*1024{return Err("download is unexpectedly small".into())}
    let mut hasher=Sha256::new();hasher.update(&bytes);let actual=format!("{:x}",hasher.finalize());
    if actual!=expected_sha256.to_ascii_lowercase(){return Err("update checksum mismatch".into())}
    fs::write(&temp,&bytes).map_err(|e|format!("write update: {e}"))?;
    let mut perms=fs::metadata(&temp).map_err(|e|e.to_string())?.permissions();perms.set_mode(0o755);fs::set_permissions(&temp,perms).map_err(|e|e.to_string())?;
    let temp_s=temp.to_string_lossy().to_string();let target_s=target.to_string_lossy().to_string();
    let script="sleep 2; mv -- \"$1\" \"$2\"; chmod +x \"$2\"; exec \"$2\"";
    Command::new("sh").arg("-c").arg(script).arg("kz-erp-updater").arg(&temp_s).arg(&target_s).spawn().map_err(|e|format!("start updater: {e}"))?;
    std::process::exit(0);
}

#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){tauri::Builder::default().invoke_handler(tauri::generate_handler![install_update]).run(tauri::generate_context!()).expect("error while running KORCZAK ERP");}
