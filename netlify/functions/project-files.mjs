export default async (request) => {
  if ((request.method||'GET') !== 'GET') return new Response('Method Not Allowed',{status:405});
  const owner = process.env.GITHUB_OWNER || 'rexx37619-cyber';
  const repo = process.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const r = await fetch(url, {headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if (!r.ok) return Response.json({ok:false,message:'Could not read the public Nimbus repository.'},{status:r.status});
  const d=await r.json();
  const files=(d.tree||[]).filter(x=>x.type==='blob').map(x=>x.path).filter(p=>!p.startsWith('.git/')).sort();
  return Response.json({ok:true,files,owner,repo,branch});
};
