import {allowedOrigin,jsonBody,requestSupabase,currentSession,storeSession,clearSession,fail} from './nimbus-secure-core.js';
const validEmail=e=>typeof e==='string' && e.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validGrade=(role,grade)=>role==='teacher' ? grade==='' : /^(?:[1-9]|1[0-2]|college-1|college-2|other)$/.test(grade);

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET' && req.method!=='POST')return fail(res,405,'METHOD_NOT_ALLOWED');
 if(req.method==='POST'&&!allowedOrigin(req))return fail(res,403,'INVALID_ORIGIN');
 try {
  if(req.method==='GET') {
   const session=await currentSession(req,res);
   if(!session)return fail(res,401,'NIMBUS_SIGN_IN_REQUIRED');
   const {user}=session;
   return res.status(200).json({ok:true,user:{id:user.id,email:user.email,role:['student','teacher'].includes(user.user_metadata?.account_type)?user.user_metadata.account_type:'student',grade:user.user_metadata?.grade||'',email_verified:true}});
  }
  const b=jsonBody(req),action=String(b.action||'');
  if(action==='logout') { const session=await currentSession(req,res); if(session)await requestSupabase('/auth/v1/logout',{method:'POST',token:session.access});clearSession(req,res);return res.status(200).json({ok:true}); }
  if(!['signup','signin'].includes(action))return fail(res,400,'INVALID_ACTION');
  const email=String(b.email||'').trim().toLowerCase(),password=b.password;
  if(!validEmail(email)||typeof password!=='string'||password.length<10||password.length>128)return fail(res,400,'INVALID_CREDENTIAL_FORMAT');
  if(action==='signup') {
   const role=String(b.role||'student'),grade=String(b.grade||'');
   if(!['student','teacher'].includes(role)||!validGrade(role,grade))return fail(res,400,'INVALID_PROFILE');
   const r=await requestSupabase('/auth/v1/signup',{method:'POST',payload:{email,password,data:{account_type:role,grade}}});
   if(!r.ok)return fail(res,400,'SIGNUP_REJECTED');
   // Supabase 'Confirm email' must be ON. Never issue a cookie until verified.
   return res.status(200).json({ok:true,confirmation_required:true,message:'Check your email to verify your Nimbus account before signing in.'});
  }
  const signed=await requestSupabase('/auth/v1/token?grant_type=password',{method:'POST',payload:{email,password}});
  if(!signed.ok||!signed.data?.access_token||!signed.data?.refresh_token)return fail(res,401,'INVALID_LOGIN');
  const u=await requestSupabase('/auth/v1/user',{token:signed.data.access_token});
  if(!u.ok||!u.data?.id||!u.data.email_confirmed_at)return fail(res,403,'EMAIL_VERIFICATION_REQUIRED');
  storeSession(req,res,signed.data);
  return res.status(200).json({ok:true,user:{id:u.data.id,email:u.data.email,role:u.data.user_metadata?.account_type||'student',grade:u.data.user_metadata?.grade||''}});
 } catch(e){return fail(res,e?.status||503,e?.status===400?'INVALID_REQUEST':e?.status===413?'BODY_TOO_LARGE':'ACCOUNT_SERVICE_UNAVAILABLE')}
}
