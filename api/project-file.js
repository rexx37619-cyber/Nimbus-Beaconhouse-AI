const ALLOWED = new Set([
  'index.html', 'app.js', 'styles.css', 'workspace.html', 'workspace.js', 'workspace.css',
  'site-layout.json', 'package.json', 'README.md', 'wrangler.toml', '_routes.json',
  'knowledge/official_links.txt', 'knowledge/beaconhouse_competitions_and_programmes.txt',
  'knowledge/book_pack_2026_links.txt'
]);
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const u = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const path = (u.searchParams.get('path') || '').replace(/^\/+/, '');
  if (!ALLOWED.has(path)) return res.status(403).json({ ok: false, message: 'That file is not in the owner editor allowlist.' });
  const owner = process.env.GITHUB_OWNER || 'rexx37619-cyber';
  const repo = process.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Nimbus-Workspace' } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || Array.isArray(d)) return res.status(r.status || 404).json({ ok: false, message: 'Could not load that repository file.' });
    if (d.encoding !== 'base64' || !d.content) return res.status(400).json({ ok: false, message: 'That file is not editable as text.' });
    const content = Buffer.from(d.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return res.status(200).json({ ok: true, path: d.path, sha: d.sha, content });
  } catch { return res.status(500).json({ ok: false, message: 'Could not reach the repository service.' }); }
}
