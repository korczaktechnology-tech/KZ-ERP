import { Router } from 'express';

const router = Router();
const GH = 'https://api.github.com';
const REPO = 'korczaktechnology-tech/KZ-ERP';
const token = process.env.GITHUB_TOKEN;

function headers(binary = false) {
  return {
    Accept: binary ? 'application/octet-stream' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2026-03-10',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

router.get('/latest', async (_req, res) => {
  try {
    const r = await fetch(`${GH}/repos/${REPO}/releases/latest`, { headers: headers() });
    if (!r.ok) return res.status(r.status).json({ error: 'GITHUB_RELEASE_LOOKUP_FAILED' });
    const release = await r.json() as any;
    const deb = release.assets?.find((a: any) => a.name.endsWith('.deb'));
    const checksum = release.assets?.find((a: any) => a.name === 'SHA256SUMS.txt');
    if (!deb || !checksum) return res.status(404).json({ error: 'RELEASE_ASSETS_INCOMPLETE' });

    const checksumResponse = await fetch(`${GH}/repos/${REPO}/releases/assets/${checksum.id}`, { headers: headers(true), redirect: 'follow' });
    if (!checksumResponse.ok) return res.status(502).json({ error: 'CHECKSUM_LOOKUP_FAILED' });
    const checksumText = await checksumResponse.text();
    const line = checksumText.split(/\r?\n/).find((value: string) => value.trim().endsWith(`  ${deb.name}`) || value.trim().endsWith(` *${deb.name}`));
    const sha256 = line?.trim().split(/\s+/)[0];
    if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) return res.status(502).json({ error: 'CHECKSUM_NOT_FOUND' });

    res.json({ version: release.tag_name.replace(/^v/, ''), tag: release.tag_name, name: release.name, notes: release.body ?? '', assetId: deb.id, assetName: deb.name, sha256 });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'GITHUB_UNAVAILABLE' });
  }
});

router.get('/asset/:assetId', async (req, res) => {
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
