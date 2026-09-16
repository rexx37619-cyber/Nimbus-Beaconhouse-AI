export default async (request) => {
  if ((request.method||'GET')!=='GET') return new Response('Method Not Allowed',{status:405});
  const u=new URL(request.url); const path=u.searchParams.get('path')||'';
  const owner=process.env.GITHUB_OWNER||'rexx37619-cyber', repo=process.env.GITHUB_REPO||'Nimbus-Beaconhouse-AI', branch=process.env.GITHUB_BRANCH||'main', token=process.env.GITHUB_TOKEN;
  if(!token) return Response.json({ok:false,message:'GitHub integration is not configured yet.'},{status:503});
  if(!path || path.includes('..')) return Response.json({ok:false,message:'Invalid file path.'},{status:400});
  const h={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const url=`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const r=await fetch(url,{headers:h}); const d=await r.json();
  if(!r.ok || Array.isArray(d)) return Response.json({ok:false,message:'Could not load that file.'},{status:r.status||404});
  let content='';
  try{content=Buffer.from((d.content||'').replace(/\n/g,''),'base64').toString('utf8')}catch{}
  return Response.json({ok:true,path:d.path,sha:d.sha,content});
};