import { invoke } from '@tauri-apps/api/core';

const UPDATE_API = (import.meta.env.VITE_UPDATE_API_URL ?? import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.3';
let checking = false;

function versionParts(version: string) {
  return version.replace(/^v/, '').split('.').map(part => Number.parseInt(part, 10) || 0);
}

function isNewer(remote: string, local: string) {
  const a = versionParts(remote);
  const b = versionParts(local);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

function validSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export async function checkForUpdate(setStatus: (status: string) => void) {
  if (checking) return;
  checking = true;
  try {
    setStatus('Verificando atualizações…');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${UPDATE_API}/api/v1/updates/latest`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timer);
    }

    if (!response.ok) throw new Error(`update metadata HTTP ${response.status}`);
    const release = await response.json() as {
      version?: string;
      assetId?: number;
      sha256?: string;
    };

    if (!release.version || !Number.isSafeInteger(release.assetId) || (release.assetId ?? 0) <= 0 || !release.sha256 || !validSha256(release.sha256)) {
      throw new Error('invalid update metadata');
    }

    if (!isNewer(release.version, CURRENT_VERSION)) {
      setStatus(`Atualizado • v${versionParts(CURRENT_VERSION).join('.')}`);
      return;
    }

    setStatus(`Atualização ${release.version} disponível • instalando…`);
    await invoke('install_update', {
      assetUrl: `${UPDATE_API}/api/v1/updates/asset/${release.assetId}`,
      version: release.version,
      expectedSha256: release.sha256.toLowerCase()
    });
  } catch (error) {
    console.warn('Updater:', error);
    setStatus('Atualização indisponível');
  } finally {
    checking = false;
  }
}
