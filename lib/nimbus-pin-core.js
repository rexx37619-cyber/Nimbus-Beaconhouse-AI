// Nimbus 34.7: passcode accounts; Vercel-only private Supabase Data API access.
// All records require an opaque, HttpOnly same-origin session cookie.
import {createHash,createHmac,randomBytes} from 'node:crypto';
const COOKIE='nimbus_pin_session';
export const PIN_LIMIT=50;
const URL_RE=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PIN_RE=/^[0-9]{6}$/;
export const ID_RE=/^[a-z0-9._%+\-]+@(?:[a-z0-9-]+\.)+edu\.pk$/i;
const CAP=90*24*60*60;
const hash=s=>createHash('sha256').update(s).digest('hex');
export const cleanId=v=>String(v??'').trim().toLowerCase();
export function validId(v){return v.length<=254&&ID_RE.test(v)}
export function originAllowed(req){const origin=req.headers?.origin;if(!origin)return true;try{const u=new URL(origin);return (u.protocol==='https:'||u.protocol==='http:')&&u.host.toLowerCase()===String(req.headers?.host||'').toLowerCase()}catch{return false}}
export function jsonError(res,http,error_code,message){return res.status(http).json({ok:false,error_code,message})}
export function config(){const url=String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');const key=String(process.env.SUPABASE_SECRET_KEY||'').trim();if(!URL_RE.test(url)||!key.startsWith('sb_secret_'))throw new Error('NIMBUS_PASSCODE_DB_NOT_CONFIGURED');return {url,key}}
export async function db(path,{method='GET',data,headers={}}={}){
 const cfg=config();const h={'apikey':cfg.key,'Content-Type':'application/json','Accept':'application/json',...headers};
 const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),9000);
 try{const r=await fetch(cfg.url+path,{method,headers:h,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:ctl.signal});const text=await r.text();let obj=null;try{obj=text?JSON.parse(text):null}catch{};return {ok:r.ok,status:r.status,data:obj,text:text.slice(0,250)}}finally{clearTimeout(timer)}
}
function headerCookie(req){const header=String(req.headers?.cookie||'');const match=header.match(/(?:^|;\s*)nimbus_pin_session=([a-f0-9]{64})(?:;|$)/);return match?.[1]||''}
export function setSessionCookie(res,token,req){const secure=String(req.headers?.['x-forwarded-proto']||'').split(',')[0]==='https'||(process.env.VERCEL_ENV==='production'&&!String(req.headers?.host||'').startsWith('localhost'));res.setHeader('Set-Cookie',`${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${CAP}${secure?'; Secure':''}`)}
export function clearSessionCookie(res,req){setSessionCookie(res,'',req);const old=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',String(old).replace(/Max-Age=\d+/, 'Max-Age=0'))}
export async function currentUser(req){
 const raw=headerCookie(req);if(!raw)return null;
 const tokenHash=hash(raw);
 const r=await db('/rest/v1/nimbus_pin_sessions?select=account_id,expires_at&token_hash=eq.'+tokenHash+'&limit=1');
 if(!r.ok||!Array.isArray(r.data)||!r.data.length)return null;
 const record=r.data[0];if(Date.parse(record.expires_at)<=Date.now())return null;
 const account=await db('/rest/v1/nimbus_pin_accounts?select=id,edu_id,created_at&id=eq.'+encodeURIComponent(record.account_id)+'&limit=1');
 if(!account.ok||!Array.isArray(account.data)||!account.data.length)return null;
 const a=account.data[0];return {id:a.id,email:a.edu_id,role:'student',verified:false,accountCreated:a.created_at,sessionHash:tokenHash};
}
export async function makeSession(req,res,userId){
 const token=randomBytes(32).toString('hex');const expires=new Date(Date.now()+CAP*1000).toISOString();
 const r=await db('/rest/v1/nimbus_pin_sessions',{method:'POST',data:{token_hash:hash(token),account_id:userId,expires_at:expires},headers:{Prefer:'return=minimal'}});
 if(!r.ok)return false;setSessionCookie(res,token,req);return true;
}
export async function destroySession(req,res){const t=headerCookie(req);clearSessionCookie(res,req);if(t)await db('/rest/v1/nimbus_pin_sessions?token_hash=eq.'+hash(t),{method:'DELETE'});}
export function clientRateKey(req){const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,95);const ua=String(req.headers?.['user-agent']||'').slice(0,120);const secret=config().key;return createHmac('sha256',secret).update(ip+'\n'+ua).digest('hex')}
export async function accountAuth(action,email,pin,rateKey){const r=await db('/rest/v1/rpc/nimbus_pin_auth',{method:'POST',data:{p_action:action,p_edu_id:email,p_code:pin,p_rate_key:rateKey}});if(!r.ok)throw new Error('ACCOUNT_DB_UNAVAILABLE');return r.data}
export async function currentQuota(){const day=new Date().toISOString().slice(0,10);const r=await db('/rest/v1/nimbus_global_daily_usage?select=used&usage_day=eq.'+day+'&limit=1');if(!r.ok)throw new Error('QUOTA_DB_UNAVAILABLE');const used=Math.min(PIN_LIMIT,Math.max(0,Number(r.data?.[0]?.used||0)));return {ok:true,used,remaining:PIN_LIMIT-used,limit:PIN_LIMIT,day,reset_timezone:'UTC'}}
export async function reserveRpd(req,res,body){
 let user;try{user=await currentUser(req)}catch{return {ok:false,http:503,error_code:'ACCOUNT_DB_UNAVAILABLE'}}
 if(!user)return {ok:false,http:401,error_code:'NIMBUS_SIGN_IN_REQUIRED'};
 const id=String(body?.client_request_id||'');if(!UUID_RE.test(id))return {ok:false,http:400,error_code:'INVALID_REQUEST_ID'};
 try{const r=await db('/rest/v1/rpc/nimbus_pin_take_rpd',{method:'POST',data:{p_account_id:user.id,p_request_id:id}});
  if(!r.ok||!r.data)return {ok:false,http:503,error_code:'QUOTA_DB_UNAVAILABLE'};
  if(!r.data.ok)return {ok:false,http:r.data.duplicate?409:429,error_code:r.data.duplicate?'DUPLICATE_REQUEST_ID':'NIMBUS_DAILY_LIMIT_REACHED',usage:r.data};
  return {ok:true,usage:r.data};
 }catch{return {ok:false,http:503,error_code:'QUOTA_DB_UNAVAILABLE'}}
}
