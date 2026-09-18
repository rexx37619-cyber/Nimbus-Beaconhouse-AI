const ALLOWED = new Set([
  'index.html', 'app.js', 'styles.css', 'workspace.html', 'workspace.js', 'workspace.css',
  'site-layout.json', 'package.json', 'README.md', 'wrangler.toml', '_routes.json',
  'knowledge/official_links.txt', 'knowledge/beaconhouse_competitions_and_programmes.txt',
  'knowledge/book_pack_2026_links.txt'
]);

export async function onRequestGet(context) {
  const u = new URL(context.request.url);
  const path = (u.searchParams.get('path') || '').replace(/^\/+/, '');
  if (!ALLOWED.has(path)) return Response.json({ ok: false, message: 'That file is not in the owner editor allowlist.' }, { status: 403 });
  const owner = context.env.GITHUB_OWNER || 'rexx37619-cyber';
  const repo = context.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI';
  const branch = context.env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Nimbus-Workspace' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || Array.isArray(d)) return Response.json({ ok: false, message: 'Could not load that repository file.' }, { status: r.status || 404 });
  if (d.encoding !== 'base64' || !d.content) return Response.json({ ok: false, message: 'That file is not editable as text.' }, { status: 400 });
  const binary = Uint8Array.from(atob(d.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  const content = new TextDecoder().decode(binary);
  return Response.json({ ok: true, path: d.path, sha: d.sha, content });
}
