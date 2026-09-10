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
    const appImage = release.assets?.find((a: any) => a.name.endsWith('.AppImage'));
    const checksum = release.assets?.find((a: any) => a.name === 'SHA256SUMS.txt');
    if (!appImage || !checksum) return res.status(404).json({ error: 'RELEASE_ASSETS_INCOMPLETE' });
    res.json({ version: release.tag_name.replace(/^v/, ''), tag: release.tag_name, name: release.name, notes: release.body ?? '', assetId: appImage.id, assetName: appImage.name, checksumAssetId: checksum.id, checksumName: checksum.name });
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
    res.setHeader('Content-Type', r.headers.get('content-type') ?? 'application/octet-stream');
    const length = r.headers.get('content-length'); if (length) res.setHeader('Content-Length', length);
    const disposition = r.headers.get('content-disposition'); if (disposition) res.setHeader('Content-Disposition', disposition);
    for await (const chunk of r.body as any) res.write(Buffer.from(chunk));
    res.end();
  } catch (error) { console.error(error); res.destroy(); }
});

export default router;
