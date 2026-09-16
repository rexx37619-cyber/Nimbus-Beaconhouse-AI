export default async (request) => {
  if ((request.method||'POST') !== 'POST') return new Response('Method Not Allowed',{status:405});
  const body=await request.json().catch(()=>({}));
  const path=String(body.path||''); const content=String(body.content??'');
  if(!path || path.includes('..')) return Response.json({ok:false,message:'Invalid file path.'},{status:400});
  return Response.json({ok:true,mode:'download-only',path,content,message:'GitHub credentials are intentionally not stored in Netlify. Download this edited file, replace the matching file in Nimbus_CLEAN, then run git add, git commit and git push origin main.'});
};
