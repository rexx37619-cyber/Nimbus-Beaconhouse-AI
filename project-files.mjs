export default async (request) => {
  const method = request.method || 'GET';
  if (method !== 'GET') return new Response('Method Not Allowed',{status:405});
  const owner = process.env.GITHUB_OWNER || 'rexx37619-cyber';
  const repo = process.env.GITHUB_REPO || 'Nimbus-Beaconhouse-AI';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;
  if (!token) return Response.json({ok:false,message:'Workspace GitHub integration is not configured yet.'},{status:503});
  const h={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const url=`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const r=await fetch(url,{headers:h});
  if(!r.ok) return Response.json({ok:false,message:'Could not read the Nimbus repository.'},{status:r.status});
  const d=await r.json();
  const files=(d.tree||[]).filter(x=>x.type==='blob').map(x=>x.path);
  return Response.json({ok:true,files,owner,repo,branch});
};