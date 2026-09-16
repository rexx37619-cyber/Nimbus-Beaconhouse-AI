export default async (request) => {
  if ((request.method||'POST')!=='POST') return new Response('Method Not Allowed',{status:405});
  const token=process.env.GITHUB_TOKEN, owner=process.env.GITHUB_OWNER||'rexx37619-cyber', repo=process.env.GITHUB_REPO||'Nimbus-Beaconhouse-AI', branch=process.env.GITHUB_BRANCH||'main';
  if(!token) return Response.json({ok:false,message:'GitHub integration is not configured yet.'},{status:503});
  const body=await request.json().catch(()=>({}));
  const path=String(body.path||''); const content=String(body.content??''); const sha=String(body.sha||'');
  if(!path || path.includes('..')) return Response.json({ok:false,message:'Invalid file path.'},{status:400});
  const allow=['index.html','app.js','styles.css','site-layout.json','workspace.html','workspace.js','workspace.css'];
  const isOwnerOnly=allow.includes(path) || path.startsWith('netlify/functions/');
  if(!isOwnerOnly) return Response.json({ok:false,message:'That file is read-only in the workspace editor.'},{status:403});
  const h={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  const put=`https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const payload={message:String(body.message||`Nimbus workspace: update ${path}`),content:Buffer.from(content,'utf8').toString('base64'),branch};
  if(sha) payload.sha=sha;
  const r=await fetch(put,{method:'PUT',headers:h,body:JSON.stringify(payload)}); const d=await r.json();
  if(!r.ok) return Response.json({ok:false,message:d.message||'GitHub rejected the update.'},{status:r.status});
  return Response.json({ok:true,commit:d.commit?.sha||null,path,branch});
};