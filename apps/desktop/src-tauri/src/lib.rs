use std::{fs, path::PathBuf, process::Command};
use sha2::{Digest, Sha256};

#[tauri::command]
async fn install_update(asset_url: String, version: String, expected_sha256: String) -> Result<(), String> {
    if version.len() > 32 || !version.chars().all(|c| c.is_ascii_alphanumeric() || ".-_".contains(c)) { return Err("invalid version".into()); }
    if !asset_url.starts_with("https://") { return Err("invalid update URL".into()); }
    if expected_sha256.len() != 64 || !expected_sha256.chars().all(|c| c.is_ascii_hexdigit()) { return Err("invalid update digest".into()); }

    let temp = PathBuf::from(format!("/tmp/kz-erp-{}.deb", version));
    let response = reqwest::get(&asset_url).await.map_err(|e| format!("download: {e}"))?;
    if !response.status().is_success() { return Err(format!("download HTTP {}", response.status())); }
    let bytes = response.bytes().await.map_err(|e| format!("read download: {e}"))?;
    if bytes.len() < 1024 * 1024 { return Err("download is unexpectedly small".into()); }
    let mut hasher = Sha256::new(); hasher.update(&bytes);
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected_sha256.to_ascii_lowercase() { return Err("update checksum mismatch".into()); }
    fs::write(&temp, &bytes).map_err(|e| format!("write update: {e}"))?;

    let status = Command::new("pkexec").arg("dpkg").arg("-i").arg(&temp).status().map_err(|e| format!("start package installer: {e}"))?;
    if !status.success() { let _ = fs::remove_file(&temp); return Err(format!("package installation failed: {status}")); }
    let _ = fs::remove_file(&temp);

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Command::new(&exe).spawn().map_err(|e| format!("restart application: {e}"))?;
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().invoke_handler(tauri::generate_handler![install_update]).run(tauri::generate_context!()).expect("error while running KORCZAK ERP");
}
