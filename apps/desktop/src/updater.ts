import { invoke } from '@tauri-apps/api/core';

const UPDATE_API = (import.meta.env.VITE_UPDATE_API_URL ?? import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.3';
let checking = false;

function versionParts(version: string) { return version.replace(/^v/, '').split('.').map(part => Number.parseInt(part, 10) || 0); }
function isNewer(remote: string, local: string) { const a = versionParts(remote); const b = versionParts(local); for (let i = 0; i < 3; i += 1) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0); return false; }
function validSha256(value: string) { return /^[a-f0-9]{64}$/i.test(value); }

export async function checkForUpdate(setStatus: (status: string) => void) {
  if (checking) return;
  checking = true;
  try {
    setStatus('Verificando atualizações…');
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try { response = await fetch(`${UPDATE_API}/api/v1/updates/latest`, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal }); }
    finally { window.clearTimeout(timer); }
    const body = await response.json().catch(() => null) as { error?: string; version?: string; assetId?: number; sha256?: string } | null;
    if (!response.ok) throw new Error(body?.error ? `${body.error} (HTTP ${response.status})` : `update metadata HTTP ${response.status}`);
    if (!body?.version || !Number.isSafeInteger(body.assetId) || (body.assetId ?? 0) <= 0 || !body.sha256 || !validSha256(body.sha256)) throw new Error('invalid update metadata');
    if (!isNewer(body.version, CURRENT_VERSION)) { setStatus(`Atualizado • v${versionParts(CURRENT_VERSION).join('.')}`); return; }
    setStatus(`Atualização v${versionParts(body.version).join('.')} disponível • instalando…`);
    await invoke('install_update', { assetUrl: `${UPDATE_API}/api/v1/updates/asset/${body.assetId}`, version: body.version, expectedSha256: body.sha256.toLowerCase() });
    setStatus(`Atualização v${versionParts(body.version).join('.')} instalada • reiniciando…`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn('Updater:', message);
    if (/UPDATE_SERVICE_NOT_CONFIGURED/i.test(message)) setStatus('Atualização indisponível • serviço não configurado');
    else if (/GITHUB_RELEASE_LOOKUP_FAILED|GITHUB_UNAVAILABLE|CHECKSUM|RELEASE_ASSET|RELEASE_DIGEST|INVALID_RELEASE_VERSION/i.test(message)) setStatus('Falha ao consultar releases • tente novamente');
    else if (/AbortError|timeout/i.test(message)) setStatus('Falha na verificação • tempo esgotado');
    else if (/package installation failed|start package installer|download:|download HTTP|checksum mismatch|write update|restart application/i.test(message)) setStatus('Falha na instalação • a versão atual foi preservada');
    else setStatus('Falha na atualização • a versão atual foi preservada');
  } finally { checking = false; }
}
