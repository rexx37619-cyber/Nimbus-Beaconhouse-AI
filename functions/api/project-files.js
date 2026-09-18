const ALLOWED = new Set([
  'index.html', 'app.js', 'styles.css', 'workspace.html', 'workspace.js', 'workspace.css',
  'site-layout.json', 'package.json', 'README.md', 'wrangler.toml', '_routes.json',
  'knowledge/official_links.txt', 'knowledge/beaconhouse_competitions_and_programmes.txt',
  'knowledge/book_pack_2026_links.txt'
]);

export async function onRequestGet(context) {
  const owner = context.env.GITHUB_OWNER || 'rexx37619-cyber';
  const repo = context.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI';
  const branch = context.env.GITHUB_BRANCH || 'main';
  return Response.json({ ok: true, owner, repo, branch, files: [...ALLOWED].sort() });
}
