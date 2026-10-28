import {cleanId,validId,PIN_RE,originAllowed,jsonError,currentUser,clientRateKey,accountAuth,makeSession,destroySession,db} from '../lib/nimbus-pin-core.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET'){
  try{const user=await currentUser(req);return user?res.status(200).json({ok:true,user:{email:user.email,role:'student',verified:false,passcode_account:true}}):jsonError(res,401,'NIMBUS_SIGN_IN_REQUIRED','Sign in to Nimbus.');}
  catch{return jsonError(res,503,'ACCOUNT_DB_UNAVAILABLE','Account database unavailable; check Nimbus server configuration.')}
 }
 if(req.method!=='POST')return jsonError(res,405,'METHOD_NOT_ALLOWED','Use POST.');
 if(!originAllowed(req))return jsonError(res,403,'INVALID_ORIGIN','Invalid request origin.');
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body)}catch{return jsonError(res,400,'INVALID_JSON','Invalid request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))return jsonError(res,400,'INVALID_BODY','Invalid request.');
 const action=String(body.action||'').toLowerCase();
 if(action==='signout'||action==='logout'){
  try{await destroySession(req,res);return res.status(200).json({ok:true})}catch{return jsonError(res,503,'ACCOUNT_DB_UNAVAILABLE','Could not sign out on the server. Retry.');}
 }
 if(!['signup','signin'].includes(action))return jsonError(res,400,'INVALID_ACTION','Choose Create account or Sign in.');
 const email=cleanId(body.educational_id||body.email);const pin=String(body.passcode||'');
 if(!validId(email))return jsonError(res,400,'INVALID_EDUCATIONAL_ID','Enter an educational email ending in .edu.pk.');
 if(!PIN_RE.test(pin))return jsonError(res,400,'INVALID_PASSCODE','The passcode must contain exactly six digits.');
 try{
  const result=await accountAuth(action,email,pin,clientRateKey(req));
  if(!result?.ok){const code=String(result?.error_code||'ACCOUNT_LOGIN_FAILED');const throttled=['TOO_MANY_ATTEMPTS','PASSCODE_LOCKED'].includes(code);
   const message={ACCOUNT_EXISTS:'This educational ID already has a Nimbus account. Sign in instead.',NO_ACCOUNT:'No Nimbus account was found. Create an account first.',INVALID_CREDENTIALS:'Wrong passcode for this educational ID. Try again.',PASSCODE_LOCKED:'Too many incorrect attempts. Try again later.',TOO_MANY_ATTEMPTS:'Too many attempts. Try again later.'}[code]||'Could not sign in. Please try again.';
   return jsonError(res,throttled?429:code==='ACCOUNT_EXISTS'?409:401,code,message)
  }
  const issued=await makeSession(req,res,result.account_id);if(!issued)return jsonError(res,503,'ACCOUNT_SESSION_FAILED','Could not start a saved session.');
  return res.status(200).json({ok:true,user:{email,role:'student',verified:false,passcode_account:true}});
 }catch{return jsonError(res,503,'ACCOUNT_DB_UNAVAILABLE','Nimbus account storage is not configured or temporarily unavailable.');}
}
