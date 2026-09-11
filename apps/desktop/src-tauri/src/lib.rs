use std::{fs, path::PathBuf, process::Command};
use sha2::{Digest, Sha256};

const UPDATE_HOST: &str = "kz-erp.onrender.com";

#[tauri::command]
async fn install_update(asset_url: String, version: String, expected_sha256: String) -> Result<(), String> {
    if version.len() > 32 || !version.chars().all(|c| c.is_ascii_alphanumeric() || ".-_".contains(c)) {
        return Err("invalid version".into());
    }
    let parsed_url = reqwest::Url::parse(&asset_url).map_err(|_| "invalid update URL".to_string())?;
    if parsed_url.scheme() != "https" || parsed_url.host_str() != Some(UPDATE_HOST) {
        return Err("update URL is not trusted".into());
    }
    if expected_sha256.len() != 64 || !expected_sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("invalid update digest".into());
    }

    let temp_dir = std::env::temp_dir();
    let temp: PathBuf = temp_dir.join(format!("kz-erp-{}-{}.deb", version, std::process::id()));
    let client = reqwest::Client::builder()
        .user_agent("KORCZAK-ERP-Updater")
        .build()
        .map_err(|e| format!("create downloader: {e}"))?;
    let response = client.get(&asset_url).send().await.map_err(|e| format!("download: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("download HTTP {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|e| format!("read download: {e}"))?;
    if bytes.len() < 1024 * 1024 {
        return Err("download is unexpectedly small".into());
    }

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected_sha256.to_ascii_lowercase() {
        return Err("update checksum mismatch".into());
    }
    fs::write(&temp, &bytes).map_err(|e| format!("write update: {e}"))?;

    let install = Command::new("pkexec")
        .arg("apt-get")
        .arg("install")
        .arg("-y")
        .arg("--no-install-recommends")
        .arg(&temp)
        .output();
    let status = match install {
        Ok(output) if output.status.success() => output.status,
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let detail = if !stderr.is_empty() { stderr } else if !stdout.is_empty() { stdout } else { format!("exit status {}", output.status) };
            let _ = fs::remove_file(&temp);
            return Err(format!("package installation failed: {detail}"));
        }
        Err(error) => {
            let _ = fs::remove_file(&temp);
            return Err(format!("start package installer: {error}"));
        }
    };
    if !status.success() {
        let _ = fs::remove_file(&temp);
        return Err(format!("package installation failed: {status}"));
    }
    let _ = fs::remove_file(&temp);

    let exe = std::env::current_exe().map_err(|e| format!("locate application: {e}"))?;
    Command::new(&exe)
        .spawn()
        .map_err(|e| format!("restart application: {e}"))?;
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![install_update])
        .run(tauri::generate_context!())
        .expect("error while running KORCZAK ERP");
}
