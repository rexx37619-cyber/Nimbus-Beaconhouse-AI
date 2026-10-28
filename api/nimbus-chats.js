import {currentUser,db,originAllowed,jsonError} from '../lib/nimbus-pin-core.js';
const CHAT_MAX=750000,LEARNING_MAX=125000;
function chatPayload(value){if(!Array.isArray(value)||value.length>40)return null;const ids=new Set(),out=[];
 for(const c of value){if(!c||typeof c.id!=='string'||c.id.length>100||ids.has(c.id)||!Array.isArray(c.messages)||c.messages.length>100)return null;
 ids.add(c.id);const messages=[];for(const m of c.messages){if(!m||!['user','ai'].includes(m.role)||typeof m.text!=='string'||m.text.length>14000)return null;messages.push({role:m.role,text:m.text,fileName:typeof m.fileName==='string'?m.fileName.slice(0,120):null})}
 out.push({id:c.id,title:String(c.title||'New chat').slice(0,120),messages});}
 return out;}
function learningPayload(value){if(!value||typeof value!=='object'||Array.isArray(value))return null;const allowed=['hint_ladder','answer_coach','find_mistake','creative_writing'],out={};for(const [mode,list] of Object.entries(value)){
 if(!allowed.includes(mode)||!Array.isArray(list)||list.length>32)return null;out[mode]=list.map(v=>{if(!v||typeof v!=='object'||!['user','ai'].includes(v.role))return null;const obj={role:v.role};if(v.role==='user'){if(typeof v.text!=='string'||v.text.length>1800)return null;obj.text=v.text;}else{if(!v.result||typeof v.result!=='object'||Array.isArray(v.result))return null;const result=JSON.stringify(v.result);if(result.length>4000)return null;obj.result=v.result;}return obj});if(out[mode].some(x=>!x))return null;}return out;}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return jsonError(res,405,'METHOD_NOT_ALLOWED','Method not allowed.');
 if(req.method==='POST'&&!originAllowed(req))return jsonError(res,403,'INVALID_ORIGIN','Invalid origin.');
 let user;try{user=await currentUser(req)}catch{return jsonError(res,503,'ACCOUNT_DB_UNAVAILABLE','Account store unavailable.');}
 if(!user)return jsonError(res,401,'NIMBUS_SIGN_IN_REQUIRED','Sign in first.');
 let kind=String(req.query?.kind||'chats');if(!['chats','learning'].includes(kind))return jsonError(res,400,'INVALID_KIND','Unsupported content type.');
 const path='/rest/v1/nimbus_pin_content?account_id=eq.'+encodeURIComponent(user.id);
 try{
  if(req.method==='GET'){
   const r=await db(path+'&select='+kind+'&limit=1');if(!r.ok)return jsonError(res,503,'CONTENT_STORE_UNAVAILABLE','Unable to read saved learning data.');
   return res.status(200).json({ok:true,[kind]:r.data?.[0]?.[kind]||(kind==='chats'?[]:{})});
  }
  const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});if(Buffer.byteLength(raw,'utf8')>(kind==='chats'?CHAT_MAX:LEARNING_MAX))return jsonError(res,413,'CONTENT_TOO_LARGE','Saved content is too large.');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  const data=kind==='chats'?chatPayload(body?.chats):learningPayload(body?.learning);
  if(data===null)return jsonError(res,400,'INVALID_CONTENT','Invalid saved learning content.');
  const r=await db(path,{method:'PATCH',data:{[kind]:data,updated_at:new Date().toISOString()},headers:{Prefer:'return=representation'}});
  if(!r.ok||!Array.isArray(r.data)||!r.data.length)return jsonError(res,503,'CONTENT_STORE_UNAVAILABLE','Could not save history.');
  return res.status(200).json({ok:true});
 }catch{return jsonError(res,503,'CONTENT_STORE_UNAVAILABLE','Saving unavailable; please retry.');}
}
