import { currentSession, allowedOrigin } from '../lib/nimbus-secure-core.js';
const getOwners=()=>new Set(String(process.env.OWNER_EMAILS||'')
 .split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method Not Allowed'});
 if(!allowedOrigin(req))return res.status(403).json({ok:false,message:'Origin denied'});
 try{
  const session=await currentSession(req,res);
  if(!session)return res.status(401).json({ok:false,role:'denied',message:'Sign in to Nimbus first.'});
  if(!getOwners().has(String(session.user.email||'').toLowerCase()))return res.status(403).json({ok:false,role:'denied',message:'Owner access denied.'});
  return res.status(200).json({ok:true,role:'owner',displayName:'Nimbus owner',permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor'],ownerOnly:true,accessAccepted:true});
 }catch{return res.status(503).json({ok:false,message:'Authorization unavailable'})}
}
