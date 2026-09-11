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

router.get('/latest', async (_req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  try {
    const r = await fetch(`${GH}/repos/${REPO}/releases/latest`, { headers: headers() });
    if (!r.ok) return res.status(r.status).json({ error: 'GITHUB_RELEASE_LOOKUP_FAILED' });
    const release = await r.json() as { tag_name?: string; name?: string; body?: string; assets?: Array<{ id?: number; name?: string; digest?: string }> };
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
    res.status(502).json({ error: 'GITHUB_UNAVAILABLE' });
  }
});

router.get('/asset/:assetId', async (req, res) => {
  if (!token) return res.status(503).json({ error: 'UPDATE_SERVICE_NOT_CONFIGURED' });
  const assetId = Number(req.params.assetId);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return res.status(400).json({ error: 'INVALID_ASSET_ID' });
  try {
    const r = await fetch(`${GH}/repos/${REPO}/releases/assets/${assetId}`, { headers: headers(true), redirect: 'follow' });
    if (!r.ok || !r.body) return res.status(r.status || 502).json({ error: 'ASSET_DOWNLOAD_FAILED' });
    res.setHeader('Content-Type', 'application/vnd.debian.binary-package');
    const length = r.headers.get('content-length'); if (length) res.setHeader('Content-Length', length);
    for await (const chunk of r.body as any) res.write(Buffer.from(chunk));
    res.end();
  } catch (error) { console.error(error); res.destroy(); }
});

export default router;
