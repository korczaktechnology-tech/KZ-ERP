use std::{fs, path::{Path, PathBuf}, process::{Command, Stdio}, time::Duration};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::{io::AsyncWriteExt, process::Command as AsyncCommand, time::timeout};

const UPDATE_HOST: &str = "kz-erp.onrender.com";
const UPDATE_API: &str = "https://kz-erp.onrender.com";
const MAX_DOWNLOAD_BYTES: u64 = 250 * 1024 * 1024;
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(180);
const PRIVILEGED_TIMEOUT: Duration = Duration::from_secs(180);
const WATCHDOG_DELAY: Duration = Duration::from_secs(60);
const UPDATE_PUBLIC_KEY_B64: &str = "k5eXcWX4grTQ4b13U/tr3GmWun8Zn1sA28RXlJOpvII=";

#[derive(Debug, Serialize, Deserialize)]
struct UpdateMarker { previous_version: String, target_version: String, backup_path: String }
struct TempFile { path: PathBuf }
impl TempFile { fn new(path: PathBuf) -> Self { Self { path } } fn path(&self) -> &Path { &self.path } fn keep(self) -> PathBuf { let path = self.path.clone(); std::mem::forget(self); path } }
impl Drop for TempFile { fn drop(&mut self) { let _ = fs::remove_file(&self.path); } }

fn parse_version(value: &str) -> Result<[u64; 3], String> {
    let clean = value.strip_prefix('v').unwrap_or(value); let mut parts = clean.split('.'); let mut out = [0_u64; 3];
    for slot in &mut out { let part = parts.next().ok_or_else(|| "invalid version".to_string())?; if part.is_empty() || part.len() > 10 || !part.chars().all(|c| c.is_ascii_digit()) { return Err("invalid version".into()); } *slot = part.parse::<u64>().map_err(|_| "invalid version".to_string())?; }
    if parts.next().is_some() { return Err("invalid version".into()); } Ok(out)
}
fn is_newer(remote: &str, local: &str) -> Result<bool, String> { Ok(parse_version(remote)? > parse_version(local)?) }
fn valid_sha256(value: &str) -> bool { value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit()) }
fn canonical_payload(version: &str, asset_id: u64, sha256: &str, asset_name: &str) -> Vec<u8> { format!("{version}\n{asset_id}\n{sha256}\n{asset_name}\n").into_bytes() }
fn verify_signature(version: &str, asset_id: u64, sha256: &str, asset_name: &str, signature: &str) -> Result<(), String> {
    if !valid_sha256(sha256) { return Err("invalid update digest".into()); }
    let bytes = BASE64.decode(UPDATE_PUBLIC_KEY_B64).map_err(|_| "invalid updater public key".to_string())?; let key_bytes: [u8; 32] = bytes.try_into().map_err(|_| "invalid updater public key".to_string())?;
    let key = VerifyingKey::from_bytes(&key_bytes).map_err(|_| "invalid updater public key".to_string())?; let sig = BASE64.decode(signature).map_err(|_| "invalid update signature".to_string())?; let signature = Signature::from_slice(&sig).map_err(|_| "invalid update signature".to_string())?;
    key.verify(&canonical_payload(version, asset_id, sha256, asset_name), &signature).map_err(|_| "update signature verification failed".to_string())
}
fn trusted_url(url: &str) -> Result<reqwest::Url, String> { let parsed = reqwest::Url::parse(url).map_err(|_| "invalid update URL".to_string())?; if parsed.scheme() != "https" || parsed.host_str() != Some(UPDATE_HOST) { return Err("update URL is not trusted".into()); } Ok(parsed) }
fn find_pkexec() -> Option<PathBuf> { std::env::var_os("PATH").and_then(|path| std::env::split_paths(&path).map(|p| p.join("pkexec")).find(|p| p.is_file())).or_else(|| { let path = PathBuf::from("/usr/bin/pkexec"); path.is_file().then_some(path) }) }
async fn run_privileged(program: &str, args: &[&str]) -> Result<std::process::Output, String> {
    let pkexec = find_pkexec().ok_or_else(|| "PKEXEC_UNAVAILABLE: pkexec não está instalado".to_string())?;
    timeout(PRIVILEGED_TIMEOUT, AsyncCommand::new(pkexec).arg(program).args(args).output()).await.map_err(|_| "PKEXEC_TIMEOUT: autenticação/instalação excedeu o tempo limite".to_string())?.map_err(|e| format!("start package installer: {e}"))
}
async fn download_to_file(app: &AppHandle, url: &str, path: &Path, expected_sha256: &str, phase: &str) -> Result<(), String> {
    trusted_url(url)?; let client = reqwest::Client::builder().user_agent("KORCZAK-ERP-Updater/2.0").timeout(DOWNLOAD_TIMEOUT).build().map_err(|e| format!("create downloader: {e}"))?;
    let response = client.get(url).send().await.map_err(|e| format!("download: {e}"))?; if !response.status().is_success() { return Err(format!("download HTTP {}", response.status())); }
    let total = response.content_length().unwrap_or(0); if total > MAX_DOWNLOAD_BYTES { return Err("download exceeds maximum allowed size".into()); }
    let mut stream = response.bytes_stream(); let mut file = tokio::fs::File::create(path).await.map_err(|e| format!("create update file: {e}"))?; let mut hasher = Sha256::new(); let mut downloaded = 0_u64;
    while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await { let chunk = chunk.map_err(|e| format!("read download: {e}"))?; downloaded = downloaded.saturating_add(chunk.len() as u64); if downloaded > MAX_DOWNLOAD_BYTES { return Err("download exceeds maximum allowed size".into()); } hasher.update(&chunk); file.write_all(&chunk).await.map_err(|e| format!("write update: {e}"))?; let percent = if total > 0 { ((downloaded.saturating_mul(100)) / total).min(100) as u8 } else { 0 }; let _ = app.emit("update-progress", serde_json::json!({"phase":phase,"downloaded":downloaded,"total":total,"percent":percent})); }
    file.flush().await.map_err(|e| format!("flush update: {e}"))?; if downloaded < 1024 * 1024 { return Err("download is unexpectedly small".into()); }
    let actual = format!("{:x}", hasher.finalize()); if actual != expected_sha256.to_ascii_lowercase() { return Err("update checksum mismatch".into()); } Ok(())
}
fn dpkg_installed_version() -> Option<String> { let output = Command::new("/usr/bin/dpkg-query").args(["-W", "-f=${Version}", env!("CARGO_PKG_NAME")]).output().ok()?; if !output.status.success() { return None; } let value = String::from_utf8_lossy(&output.stdout).trim().to_string(); (!value.is_empty()).then_some(value) }
fn dpkg_package_name(path: &Path) -> Result<(), String> { let path_text = path.to_string_lossy().into_owned(); let output = Command::new("/usr/bin/dpkg-deb").args(["-f", &path_text, "Package"]).output().map_err(|e| format!("read package metadata: {e}"))?; if !output.status.success() { return Err("invalid Debian package".into()); } let name = String::from_utf8_lossy(&output.stdout).trim().to_string(); if name != env!("CARGO_PKG_NAME") { return Err("update package identity mismatch".into()); } Ok(()) }
fn marker_path() -> PathBuf { std::env::temp_dir().join("kz-erp-update-pending.json") }
fn manual_download_path(version: &str) -> PathBuf { let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); home.join("Downloads").join(format!("KORCZAK-ERP-{version}.deb")) }
fn open_manual_installer(path: &Path) { let _ = Command::new("xdg-open").arg(path).stdout(Stdio::null()).stderr(Stdio::null()).spawn(); }

#[tauri::command]
async fn install_update(app: AppHandle, asset_url: String, version: String, current_version: String, asset_id: u64, expected_sha256: String, signature: String) -> Result<(), String> {
    parse_version(&version)?; parse_version(&current_version)?; if !is_newer(&version, &current_version)? { return Err("downgrade or same-version update rejected".into()); } if current_version != env!("CARGO_PKG_VERSION") { return Err("installed application version metadata is inconsistent".into()); }
    verify_signature(&version, asset_id, &expected_sha256, "KORCZAK-ERP-linux-amd64.deb", &signature)?; trusted_url(&asset_url)?;
    let temp = TempFile::new(std::env::temp_dir().join(format!("kz-erp-{version}-{}-update.deb", std::process::id()))); download_to_file(&app, &asset_url, temp.path(), &expected_sha256, "download").await?; dpkg_package_name(temp.path())?;

    let client = reqwest::Client::builder().user_agent("KORCZAK-ERP-Updater/2.0").timeout(Duration::from_secs(30)).build().map_err(|e| format!("create metadata client: {e}"))?; let previous_response = client.get(format!("{UPDATE_API}/api/v1/updates/previous?before={current_version}")).send().await.map_err(|e| format!("previous release lookup: {e}"))?; if !previous_response.status().is_success() { return Err("PREVIOUS_RELEASE_NOT_FOUND: não foi possível preparar rollback".into()); }
    let previous = previous_response.json::<serde_json::Value>().await.map_err(|e| format!("previous release metadata: {e}"))?; let previous_version = previous.get("version").and_then(|v| v.as_str()).ok_or_else(|| "invalid previous release metadata".to_string())?.to_string(); let previous_id = previous.get("assetId").and_then(|v| v.as_u64()).ok_or_else(|| "invalid previous release asset".to_string())?; let previous_sha = previous.get("sha256").and_then(|v| v.as_str()).ok_or_else(|| "invalid previous release digest".to_string())?.to_string(); let previous_signature = previous.get("signature").and_then(|v| v.as_str()).ok_or_else(|| "invalid previous release signature".to_string())?.to_string();
    verify_signature(&previous_version, previous_id, &previous_sha, "KORCZAK-ERP-linux-amd64.deb", &previous_signature)?; if !is_newer(&current_version, &previous_version)? { return Err("invalid rollback version".into()); }
    let backup = TempFile::new(std::env::temp_dir().join(format!("kz-erp-{current_version}-{}-rollback.deb", std::process::id()))); let backup_url = format!("{UPDATE_API}/api/v1/updates/asset/{previous_id}?version={previous_version}&sha256={previous_sha}"); download_to_file(&app, &backup_url, backup.path(), &previous_sha, "backup").await?; dpkg_package_name(backup.path())?;
    let marker = marker_path(); write_marker(&marker, &UpdateMarker { previous_version, target_version: version.clone(), backup_path: backup.path().to_string_lossy().into_owned() })?; let backup_path = backup.keep();

    let temp_arg = temp.path().to_string_lossy().into_owned(); let mut output = match run_privileged("/usr/bin/dpkg", &["--install", &temp_arg]).await { Ok(output) => output, Err(error) if error.starts_with("PKEXEC_UNAVAILABLE") || error.starts_with("PKEXEC_TIMEOUT") => { let manual = manual_download_path(&version); if let Some(parent) = manual.parent() { let _ = fs::create_dir_all(parent); } fs::copy(temp.path(), &manual).map_err(|e| format!("{error}; manual copy failed: {e}"))?; open_manual_installer(&manual); let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err(format!("MANUAL_INSTALL_REQUIRED:{}", manual.display())); }, Err(error) => { let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err(error); } };
    if !output.status.success() { let repair = run_privileged("/usr/bin/apt-get", &["-f", "install", "-y", "--no-install-recommends"]).await; if repair.as_ref().map(|o| o.status.success()).unwrap_or(false) { output = run_privileged("/usr/bin/dpkg", &["--install", &temp_arg]).await.map_err(|e| e.to_string())?; } else { let detail = String::from_utf8_lossy(&output.stderr).trim().to_string(); let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err(if detail.is_empty() { "package installation failed".into() } else { format!("package installation failed: {detail}") }); } }
    if !output.status.success() { let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err("package installation failed after dependency repair".into()); }
    let installed = dpkg_installed_version().ok_or_else(|| "post-install package verification failed".to_string())?; if parse_version(&installed)? != parse_version(&version)? { let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err("post-install version verification failed".into()); }

    let exe = std::env::current_exe().map_err(|e| format!("locate application: {e}"))?; let marker_arg = marker.to_string_lossy().into_owned(); Command::new(&exe).arg("--kz-update-watchdog").arg(&marker_arg).spawn().map_err(|e| format!("start update watchdog: {e}"))?; let mut child = Command::new(&exe).spawn().map_err(|e| format!("restart application: {e}"))?; std::thread::sleep(Duration::from_secs(3));
    if let Some(status) = child.try_wait().map_err(|e| format!("verify application start: {e}"))? { let _ = run_privileged("/usr/bin/dpkg", &["--install", "--force-downgrade", &backup_path]).await; let _ = fs::remove_file(&marker); let _ = fs::remove_file(&backup_path); return Err(format!("restart application failed with {status}")); }
    let _ = app.emit("update-progress", serde_json::json!({"phase":"restart","downloaded":1,"total":1,"percent":100})); std::process::exit(0);
}

fn write_marker(path: &Path, marker: &UpdateMarker) -> Result<(), String> { fs::write(path, serde_json::to_vec(marker).map_err(|_| "serialize update marker".to_string())?).map_err(|e| format!("write update marker: {e}")) }

#[tauri::command]
fn confirm_update() -> Result<(), String> { let marker = marker_path(); if !marker.exists() { return Ok(()); } let pending: UpdateMarker = serde_json::from_slice(&fs::read(&marker).map_err(|e| format!("read update marker: {e}"))?).map_err(|e| format!("read update marker: {e}"))?; if pending.target_version != env!("CARGO_PKG_VERSION") { return Err("running version does not match pending update".into()); } let installed = dpkg_installed_version().unwrap_or_default(); if parse_version(&installed).ok() != parse_version(&pending.target_version).ok() { return Err("installed package version does not match pending update".into()); } fs::remove_file(&marker).map_err(|e| format!("clear update marker: {e}"))?; let _ = fs::remove_file(&pending.backup_path); Ok(()) }

pub fn run_update_watchdog(marker_file: &str) { let path = PathBuf::from(marker_file); std::thread::sleep(WATCHDOG_DELAY); if !path.exists() { return; } let pending: UpdateMarker = match fs::read(&path).ok().and_then(|b| serde_json::from_slice(&b).ok()) { Some(value) => value, None => return }; let backup = PathBuf::from(&pending.backup_path); if !backup.is_file() { return; } if let Some(pkexec) = find_pkexec() { let _ = Command::new(pkexec).arg("/usr/bin/dpkg").args(["--install", "--force-downgrade", backup.to_string_lossy().as_ref()]).status(); } let _ = fs::remove_file(&path); let _ = fs::remove_file(backup); }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() { tauri::Builder::default().invoke_handler(tauri::generate_handler![install_update, confirm_update]).run(tauri::generate_context!()).expect("error while running KORCZAK ERP"); }
