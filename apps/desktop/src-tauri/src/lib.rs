use std::{fs, path::PathBuf, process::Command};
use sha2::{Digest, Sha256};

const UPDATE_HOST: &str = "kz-erp.onrender.com";

fn run_privileged(program: &str, args: &[&str]) -> Result<std::process::Output, String> {
    let pkexec = std::env::var_os("PATH")
        .and_then(|path| std::env::split_paths(&path).map(|p| p.join("pkexec")).find(|p| p.is_file()))
        .unwrap_or_else(|| PathBuf::from("/usr/bin/pkexec"));
    if !pkexec.is_file() {
        return Err("pkexec is not installed; install PolicyKit/pkexec to enable automatic updates".into());
    }
    Command::new(pkexec)
        .arg(program)
        .args(args)
        .output()
        .map_err(|error| format!("start package installer: {error}"))
}

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
    let temp_arg = temp.to_string_lossy().into_owned();
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

    // Install the already-verified local package as root. dpkg is deterministic for a
    // local .deb; if a future package introduces dependencies, repair them with apt and retry.
    let mut output = run_privileged("/usr/bin/dpkg", &["--install", &temp_arg])?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let repair = run_privileged("/usr/bin/apt-get", &["-f", "install", "-y", "--no-install-recommends"])?;
        if !repair.status.success() {
            let repair_detail = String::from_utf8_lossy(&repair.stderr).trim().to_string();
            let _ = fs::remove_file(&temp);
            return Err(if !repair_detail.is_empty() {
                format!("package installation failed: {repair_detail}")
            } else if !detail.is_empty() {
                format!("package installation failed: {detail}")
            } else {
                format!("package installation failed: {}", repair.status)
            });
        }
        output = run_privileged("/usr/bin/dpkg", &["--install", &temp_arg])?;
    }
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else if !stdout.is_empty() { stdout } else { format!("exit status {}", output.status) };
        let _ = fs::remove_file(&temp);
        return Err(format!("package installation failed: {detail}"));
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
