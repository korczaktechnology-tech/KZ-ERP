import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const UPDATE_API = (import.meta.env.VITE_UPDATE_API_URL ?? import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.1.3';
let checking = false;

type UpdateMetadata = { version?: string; assetId?: number; assetName?: string; sha256?: string; signature?: string };
function versionParts(version: string): [number, number, number] { const clean = version.replace(/^v/, ''); if (!/^\d+\.\d+\.\d+$/.test(clean)) throw new Error('invalid local application version'); return clean.split('.').map(Number) as [number, number, number]; }
function isNewer(remote: string, local: string) { const a = versionParts(remote); const b = versionParts(local); for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i]; return false; }
function validSha256(value: string) { return /^[a-f0-9]{64}$/i.test(value); }
function validSignature(value: string) { return /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 80 && value.length <= 256; }

export async function checkForUpdate(setStatus: (status: string) => void) {
  if (checking) return;
  checking = true;
  let unlisten: (() => void) | undefined;
  try {
    versionParts(CURRENT_VERSION);
    await confirmPendingUpdate();
    setStatus('Verificando atualizações…');
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try { response = await fetch(`${UPDATE_API}/api/v1/updates/latest`, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal }); }
    finally { window.clearTimeout(timer); }
    const body = await response.json().catch(() => null) as UpdateMetadata & { error?: string } | null;
    if (!response.ok) throw new Error(body?.error ? `${body.error} (HTTP ${response.status})` : `update metadata HTTP ${response.status}`);
    if (!body?.version || !Number.isSafeInteger(body.assetId) || (body.assetId ?? 0) <= 0 || body.assetName !== 'KORCZAK-ERP-linux-amd64.deb' || !body.sha256 || !validSha256(body.sha256) || !body.signature || !validSignature(body.signature)) throw new Error('invalid signed update metadata');
    if (!isNewer(body.version, CURRENT_VERSION)) { setStatus(`Atualizado • v${versionParts(CURRENT_VERSION).join('.')}`); return; }

    setStatus(`Atualização v${versionParts(body.version).join('.')} disponível • preparando…`);
    unlisten = await listen<{ phase: string; downloaded: number; total: number; percent: number }>('update-progress', event => {
      const progress = event.payload;
      if (progress.phase === 'backup') setStatus(`Preparando rollback seguro… ${progress.percent}%`);
      else if (progress.phase === 'download') setStatus(`Baixando atualização… ${progress.percent}%`);
      else if (progress.phase === 'restart') setStatus(`Atualização v${versionParts(body.version!).join('.')} instalada • reiniciando…`);
    });

    const assetUrl = `${UPDATE_API}/api/v1/updates/asset/${body.assetId}?version=${encodeURIComponent(body.version)}&sha256=${encodeURIComponent(body.sha256.toLowerCase())}`;
    await invoke('install_update', { assetUrl, version: body.version, currentVersion: CURRENT_VERSION, assetId: body.assetId, expectedSha256: body.sha256.toLowerCase(), signature: body.signature });
    setStatus(`Atualização v${versionParts(body.version).join('.')} instalada • reiniciando…`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn('Updater:', message);
    if (/UPDATE_SERVICE_NOT_CONFIGURED/i.test(message)) setStatus('Atualização indisponível • serviço não configurado');
    else if (/UPDATE_SIGNATURE|invalid signed update metadata|signature verification/i.test(message)) setStatus('Falha de segurança • atualização não confiável foi bloqueada');
    else if (/GITHUB_RELEASE_LOOKUP_FAILED|GITHUB_UNAVAILABLE|CHECKSUM|RELEASE_ASSET|RELEASE_DIGEST|INVALID_RELEASE_VERSION|PREVIOUS_RELEASE/i.test(message)) setStatus('Falha ao preparar atualização • versão atual preservada');
    else if (/AbortError|timeout|PKEXEC_TIMEOUT/i.test(message)) setStatus('Falha na atualização • operação excedeu o tempo limite');
    else if (/MANUAL_INSTALL_REQUIRED:(.+)/i.test(message)) setStatus('Instalação requer confirmação manual • pacote foi aberto');
    else if (/package installation failed|start package installer|download:|download HTTP|checksum mismatch|write update|restart application|post-install/i.test(message)) setStatus('Falha na instalação • rollback automático disponível');
    else setStatus('Falha na atualização • a versão atual foi preservada');
  } finally { unlisten?.(); checking = false; }
}

export async function confirmPendingUpdate() { try { await invoke('confirm_update'); } catch (error) { console.warn('Updater confirmation:', error); } }
