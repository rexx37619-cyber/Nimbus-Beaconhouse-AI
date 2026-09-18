const ALLOWED = new Set([
  'index.html', 'app.js', 'styles.css', 'workspace.html', 'workspace.js', 'workspace.css',
  'site-layout.json', 'package.json', 'README.md', 'wrangler.toml', '_routes.json',
  'knowledge/official_links.txt', 'knowledge/beaconhouse_competitions_and_programmes.txt',
  'knowledge/book_pack_2026_links.txt'
]);
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  return res.status(200).json({ ok: true, owner: process.env.GITHUB_OWNER || 'rexx37619-cyber', repo: process.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI', branch: process.env.GITHUB_BRANCH || 'main', files: [...ALLOWED].sort() });
}
