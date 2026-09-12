import { Router } from 'express';

const router = Router();
const GH = 'https://api.github.com';
const REPO = 'korczaktechnology-tech/KZ-ERP';
const token = process.env.GITHUB_TOKEN;
const MAX_ASSET_BYTES = 250 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 120_000;

type ReleaseAsset = { id?: number; name?: string; digest?: string; size?: number };
type Release = { tag_name?: string; name?: string; body?: string; published_at?: string; assets?: ReleaseAsset[] };

function headers(binary = false) {
  return {
    Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'KORCZAK-ERP-Updater/2.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}
function validSha256(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function validSignature(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length >= 80 && value.length <= 256; }
function validAssetId(value: string): number | null { if (!/^\d+$/.test(value)) return null; const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }
function version(value: string | undefined): string | null { const v = value?.replace(/^v/, ''); return v && /^\d+\.\d+\.\d+$/.test(v) ? v : null; }
function versionTuple(v: string) { return v.split('.').map(Number) as [number, number, number]; }
function compareVersion(a: string, b: string) { const x = versionTuple(a); const y = versionTuple(b); for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i]; return 0; }
function debAsset(release: Release) { return release.assets?.find(asset => typeof asset.id === 'number' && typeof asset.name === 'string' && asset.name === 'KORCZAK-ERP-linux-amd64.deb'); }
function signatureAsset(release: Release) { return release.assets?.find(asset => asset.name === 'UPDATE-MANIFEST.json' && typeof asset.id === 'number'); }
async function githubFetch(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
async function latestRelease() {
  const response = await githubFetch(`${GH}/repos/${REPO}/releases/latest`, { headers: headers() });
  if (!response.ok) throw new Error(`GITHUB_RELEASE_LOOKUP_FAILED:${response.status}`);
  return await response.json() as Release;
}
async function releaseByVersion(target: string) {
  if (!/^\d+\.\d+\.\d+$/.test(target)) return null;
  const response = await githubFetch(`${GH}/repos/${REPO}/releases/tags/v${target}`, { headers: headers() });
  if (!response.ok) return null;
  return await response.json() as Release;
}
async function signedManifest(release: Release) {
  const deb = debAsset(release);
  const sig = signatureAsset(release);
  if (!deb?.id || !deb.name || !sig?.id) throw new Error('UPDATE_SIGNATURE_NOT_FOUND');
  const response = await githubFetch(`${GH}/repos/${REPO}/releases/assets/${sig.id}`, { headers: headers(true), redirect: 'follow' });
  if (!response.ok) throw new Error('UPDATE_SIGNATURE_LOOKUP_FAILED');
  const manifest = await response.json() as { version?: string; assetId?: number; assetName?: string; sha256?: string; signature?: string };
  const releaseVersion = version(release.tag_name);
  if (!releaseVersion || manifest.version !== releaseVersion || manifest.assetId !== deb.id || manifest.assetName !== deb.name || !validSha256(manifest.sha256) || !validSignature(manifest.signature)) {
    throw new Error('UPDATE_SIGNATURE_INVALID');
  }
  const digest = typeof deb.digest === 'string' && deb.digest.toLowerCase().startsWith('sha256:') ? deb.digest.slice(7).toLowerCase() : '';
  if (validSha256(digest) && digest !== manifest.sha256.toLowerCase()) throw new Error('UPDATE_SIGNATURE_DIGEST_MISMATCH');
  return { ...manifest, version: releaseVersion, assetId: deb.id, assetName: deb.name, sha256: manifest.sha256.toLowerCase() };
}

router.get('/latest', async (_req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  try {
    const release = await latestRelease();
    const deb = debAsset(release);
    if (!deb?.id || !deb.name) return res.status(404).json({ error: 'RELEASE_ASSET_NOT_FOUND' });
    const manifest = await signedManifest(release);
    res.json({ version: manifest.version, tag: release.tag_name, name: release.name, notes: release.body ?? '', assetId: deb.id, assetName: deb.name, sha256: manifest.sha256, signature: manifest.signature });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : '';
    const status = message.startsWith('GITHUB_RELEASE_LOOKUP_FAILED:') ? Number(message.split(':')[1]) : message === 'UPDATE_SIGNATURE_NOT_FOUND' || message === 'UPDATE_SIGNATURE_INVALID' || message === 'UPDATE_SIGNATURE_DIGEST_MISMATCH' ? 502 : 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: message.startsWith('GITHUB_RELEASE_LOOKUP_FAILED:') ? 'GITHUB_RELEASE_LOOKUP_FAILED' : message || 'GITHUB_RELEASE_LOOKUP_FAILED' });
  }
});

router.get('/previous', async (req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  const before = typeof req.query.before === 'string' ? req.query.before : '';
  const current = version(before);
  if (!current) return res.status(400).json({ error: 'INVALID_VERSION' });
  try {
    const response = await githubFetch(`${GH}/repos/${REPO}/releases?per_page=100`, { headers: headers() });
    if (!response.ok) return res.status(502).json({ error: 'GITHUB_RELEASE_LOOKUP_FAILED' });
    const releases = await response.json() as Release[];
    const candidates = releases.map(release => ({ release, version: version(release.tag_name) })).filter(item => item.version && compareVersion(item.version, current) < 0).sort((a, b) => compareVersion(b.version!, a.version!));
    const selected = candidates[0]?.release;
    if (!selected) return res.status(404).json({ error: 'PREVIOUS_RELEASE_NOT_FOUND' });
    const deb = debAsset(selected);
    if (!deb?.id || !deb.name) return res.status(404).json({ error: 'PREVIOUS_RELEASE_ASSET_NOT_FOUND' });
    const manifest = await signedManifest(selected);
    res.json({ version: manifest.version, assetId: deb.id, assetName: deb.name, sha256: manifest.sha256, signature: manifest.signature });
  } catch (error) { console.error(error); res.status(502).json({ error: 'PREVIOUS_RELEASE_LOOKUP_FAILED' }); }
});

router.get('/asset/:assetId', async (req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  const assetId = validAssetId(req.params.assetId);
  const requestedVersion = typeof req.query.version === 'string' ? version(req.query.version) : null;
  const requestedSha = typeof req.query.sha256 === 'string' ? req.query.sha256.toLowerCase() : '';
  if (assetId === null) return res.status(400).json({ error: 'INVALID_ASSET_ID' });
  if (!requestedVersion || !validSha256(requestedSha)) return res.status(400).json({ error: 'INVALID_ASSET_BINDING' });
  try {
    const release = await releaseByVersion(requestedVersion);
    if (!release) return res.status(404).json({ error: 'RELEASE_NOT_FOUND' });
    const manifest = await signedManifest(release);
    if (manifest.assetId !== assetId || manifest.sha256 !== requestedSha) return res.status(409).json({ error: 'ASSET_BINDING_MISMATCH' });
    const deb = debAsset(release);
    if (!deb?.size || deb.size > MAX_ASSET_BYTES) return res.status(413).json({ error: 'ASSET_TOO_LARGE' });
    const r = await githubFetch(`${GH}/repos/${REPO}/releases/assets/${assetId}`, { headers: headers(true), redirect: 'follow' });
    if (!r.ok || !r.body) return res.status(r.status || 502).json({ error: 'ASSET_DOWNLOAD_FAILED' });
    const length = Number(r.headers.get('content-length') ?? deb.size);
    if (!Number.isFinite(length) || length <= 0 || length > MAX_ASSET_BYTES) return res.status(413).json({ error: 'ASSET_TOO_LARGE' });
    res.setHeader('Content-Type', 'application/vnd.debian.binary-package');
    res.setHeader('Content-Length', String(length));
    for await (const chunk of r.body as any) res.write(Buffer.from(chunk));
    res.end();
  } catch (error) { console.error(error); if (!res.headersSent) res.status(502).json({ error: 'ASSET_DOWNLOAD_FAILED' }); else res.destroy(); }
});

export default router;
