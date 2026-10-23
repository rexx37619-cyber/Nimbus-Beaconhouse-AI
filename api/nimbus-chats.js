import { allowedOrigin, currentSession, fail, requestSupabase } from '../lib/nimbus-secure-core.js';
const MAX_BYTES=750000;
function sanitizeChats(input){
 if(!Array.isArray(input)||input.length>40) return null;
 const seen=new Set();
 const out=[];
 for(const c of input){
  if(!c||typeof c!=='object'||typeof c.id!=='string'||c.id.length>100||seen.has(c.id))return null;
  seen.add(c.id);
  if(!Array.isArray(c.messages)||c.messages.length>100)return null;
  const messages=[];
  for(const m of c.messages){
   if(!m||!['ai','user'].includes(m.role)||typeof m.text!=='string'||m.text.length>14000)return null;
   messages.push({role:m.role,text:m.text,fileName:typeof m.fileName==='string'?m.fileName.slice(0,120):null});
  }
  out.push({id:c.id,title:String(c.title||'New chat').slice(0,120),messages});
 }
 return out;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return fail(res,405,'METHOD_NOT_ALLOWED');
 if(req.method==='POST'&&!allowedOrigin(req))return fail(res,403,'INVALID_ORIGIN');
 try{
  const session=await currentSession(req,res);
  if(!session)return fail(res,401,'NIMBUS_SIGN_IN_REQUIRED');
  if(req.method==='GET'){
   const r=await requestSupabase('/rest/v1/nimbus_chats?select=chats&limit=1',{token:session.access});
   if(!r.ok||!Array.isArray(r.data))return fail(res,503,'CHAT_STORE_UNAVAILABLE');
   return res.status(200).json({ok:true,chats:Array.isArray(r.data[0]?.chats)?r.data[0].chats:[]});
  }
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)return fail(res,413,'CHATS_TOO_LARGE');
  const body=JSON.parse(raw);
  const chats=sanitizeChats(body?.chats);
  if(!chats)return fail(res,400,'INVALID_CHATS');
  const r=await requestSupabase('/rest/v1/nimbus_chats?on_conflict=user_id',{
   method:'POST',token:session.access,payload:[{user_id:session.user.id,chats}],
   headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
  });
  if(!r.ok)return fail(res,503,'CHAT_SAVE_UNAVAILABLE');
  return res.status(200).json({ok:true});
 }catch{return fail(res,503,'CHAT_STORE_UNAVAILABLE')}
}
