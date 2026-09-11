import { Router } from 'express';

const router = Router();
const GH = 'https://api.github.com';
const REPO = 'korczaktechnology-tech/KZ-ERP';
const token = process.env.GITHUB_TOKEN;

function headers(binary = false) {
  return {
    Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'KORCZAK-ERP-Updater/1.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}
function validSha256(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }
function validAssetId(value: string): number | null { if (!/^\d+$/.test(value)) return null; const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null; }

async function latestRelease() {
  const response = await fetch(`${GH}/repos/${REPO}/releases/latest`, { headers: headers() });
  if (!response.ok) throw new Error(`GITHUB_RELEASE_LOOKUP_FAILED:${response.status}`);
  return await response.json() as { tag_name?: string; name?: string; body?: string; assets?: Array<{ id?: number; name?: string; digest?: string }> };
}

router.get('/latest', async (_req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  try {
    const release = await latestRelease();
    const deb = release.assets?.find(asset => typeof asset.name === 'string' && asset.name.endsWith('.deb'));
    if (!deb?.id || !deb.name) return res.status(404).json({ error: 'RELEASE_ASSET_NOT_FOUND' });

    let sha256 = typeof deb.digest === 'string' && deb.digest.toLowerCase().startsWith('sha256:') ? deb.digest.slice(7).toLowerCase() : '';
    if (!validSha256(sha256)) {
      const checksum = release.assets?.find(asset => asset.name === 'SHA256SUMS.txt');
      if (!checksum?.id) return res.status(502).json({ error: 'RELEASE_DIGEST_NOT_FOUND' });
      const checksumResponse = await fetch(`${GH}/repos/${REPO}/releases/assets/${checksum.id}`, { headers: headers(true), redirect: 'follow' });
      if (!checksumResponse.ok) return res.status(502).json({ error: 'CHECKSUM_LOOKUP_FAILED' });
      const checksumText = await checksumResponse.text();
      const line = checksumText.split(/\r?\n/).find(value => value.trim().endsWith(`  ${deb.name}`) || value.trim().endsWith(` *${deb.name}`));
      const candidate = line?.trim().split(/\s+/)[0] ?? '';
      if (!validSha256(candidate)) return res.status(502).json({ error: 'CHECKSUM_NOT_FOUND' });
      sha256 = candidate.toLowerCase();
    }

    const version = release.tag_name?.replace(/^v/, '');
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return res.status(502).json({ error: 'INVALID_RELEASE_VERSION' });
    res.json({ version, tag: release.tag_name, name: release.name, notes: release.body ?? '', assetId: deb.id, assetName: deb.name, sha256 });
  } catch (error) {
    console.error(error);
    const status = error instanceof Error && error.message.startsWith('GITHUB_RELEASE_LOOKUP_FAILED:') ? Number(error.message.split(':')[1]) : 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: 'GITHUB_RELEASE_LOOKUP_FAILED' });
  }
});

router.get('/asset/:assetId', async (req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  const assetId = validAssetId(req.params.assetId);
  if (assetId === null) return res.status(400).json({ error: 'INVALID_ASSET_ID' });
  try {
    // Never proxy an arbitrary release asset. Bind downloads to the .deb exposed by /latest.
    const release = await latestRelease();
    const deb = release.assets?.find(asset => asset.id === assetId && typeof asset.name === 'string' && asset.name.endsWith('.deb'));
    if (!deb?.id || !deb.name) return res.status(404).json({ error: 'RELEASE_ASSET_NOT_FOUND' });
    const r = await fetch(`${GH}/repos/${REPO}/releases/assets/${assetId}`, { headers: headers(true), redirect: 'follow' });
    if (!r.ok || !r.body) return res.status(r.status || 502).json({ error: 'ASSET_DOWNLOAD_FAILED' });
    res.setHeader('Content-Type', 'application/vnd.debian.binary-package');
    const length = r.headers.get('content-length'); if (length) res.setHeader('Content-Length', length);
    for await (const chunk of r.body as any) res.write(Buffer.from(chunk));
    res.end();
  } catch (error) { console.error(error); if (!res.headersSent) res.status(502).json({ error: 'ASSET_DOWNLOAD_FAILED' }); else res.destroy(); }
});

export default router;
