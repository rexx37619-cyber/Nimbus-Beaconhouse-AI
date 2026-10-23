// Nimbus secure account utilities — no password or Supabase secret is embedded in client assets.
export const DAILY_LIMIT = 1500;
const ACCESS_COOKIE = 'nimbus_a';
const REFRESH_COOKIE = 'nimbus_r';
const MAX_BODY = 4096;

function cfg() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '');
  if (!/^https:\/\/[\w.-]+$/.test(url) || !key) throw Object.assign(new Error('SUPABASE_NOT_CONFIGURED'), { status: 503 });
  return { url, key };
}
export function fail(res, status, code, extra = {}) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ok: false, error_code: code, ...extra});
}
function cookieValue(req, key) {
  const line = String(req.headers?.cookie || '');
  const item = line.split(';').map(p => p.trim()).find(p => p.startsWith(key+'='));
  return item ? decodeURIComponent(item.slice(key.length+1)) : '';
}
function cookie(name, value, req, age) {
  const secure = req.headers?.['x-forwarded-proto'] === 'https' || !!req.socket?.encrypted;
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
export function storeSession(req,res,auth) {
  if (!auth?.access_token || !auth?.refresh_token) throw new Error('SESSION_INCOMPLETE');
  res.setHeader('Set-Cookie', [
    cookie(ACCESS_COOKIE,auth.access_token,req,Math.min(3600,Number(auth.expires_in || 3600))),
    cookie(REFRESH_COOKIE,auth.refresh_token,req,60*60*24*30),
  ]);
}
export function clearSession(req,res) {
  res.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE,'',req,0),cookie(REFRESH_COOKIE,'',req,0)]);
}
export function allowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Node clients may omit Origin; browser cross-origin POSTs send it.
  try { return new URL(origin).host === String(req.headers?.host || '').toLowerCase() && ['http:','https:'].includes(new URL(origin).protocol); }
  catch { return false; }
}
export function jsonBody(req) {
  const length = Number(req.headers?.['content-length'] || 0);
  if (length > MAX_BODY) throw Object.assign(new Error('BODY_TOO_LARGE'),{status:413});
  if (typeof req.body === 'string' && req.body.length > MAX_BODY) throw Object.assign(new Error('BODY_TOO_LARGE'),{status:413});
  const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Object.assign(new Error('INVALID_BODY'),{status:400});
  return parsed;
}
export async function requestSupabase(route, { method='GET', payload, token, signal, headers:extraHeaders={} } = {}) {
  const {url,key} = cfg();
  const headers = {'apikey':key, 'Accept':'application/json',...extraHeaders};
  // Supabase publishable keys are API keys, NOT JWT bearer tokens.
  if (token) headers.Authorization = 'Bearer '+token;
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),10000);
  let response;
  try { response = await fetch(url+route,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),signal:signal||controller.signal}); }
  finally { clearTimeout(timer); }
  const content = await response.text();
  let data={}; try { data=content?JSON.parse(content):{}; } catch { data={}; }
  return {ok:response.ok,status:response.status,data};
}
export async function currentSession(req,res) {
  const access = cookieValue(req,ACCESS_COOKIE);
  if (access) {
    const user = await requestSupabase('/auth/v1/user',{token:access});
    if(user.ok && user.data?.id && user.data?.email_confirmed_at) return {user:user.data,access};
  }
  const refresh = cookieValue(req,REFRESH_COOKIE);
  if (!refresh) return null;
  const fresh = await requestSupabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',payload:{refresh_token:refresh}});
  if(!fresh.ok || !fresh.data?.access_token || !fresh.data?.refresh_token) { clearSession(req,res); return null; }
  const user = await requestSupabase('/auth/v1/user',{token:fresh.data.access_token});
  if(!user.ok || !user.data?.id || !user.data?.email_confirmed_at) { clearSession(req,res); return null; }
  storeSession(req,res,fresh.data);
  return {user:user.data,access:fresh.data.access_token};
}
export const VALID_MODES = Object.freeze({xhigh:1,normal:1,rapid:2,max:3,'super-rapid':3});
export function modeCost(mode) { return VALID_MODES[String(mode||'normal').toLowerCase()] || null; }
export function validRequestId(id) {
  return typeof id==='string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id);
}
export async function reserveRpd(req,res,body) {
  const session=await currentSession(req,res);
  if(!session) return {ok:false,http:401,error_code:'NIMBUS_SIGN_IN_REQUIRED'};
  const cost=modeCost(body.speed_mode);
  if(!cost) return {ok:false,http:400,error_code:'INVALID_SPEED_MODE'};
  const requestId=body.client_request_id;
  if(!validRequestId(requestId)) return {ok:false,http:400,error_code:'INVALID_REQUEST_ID'};
  const rpc=await requestSupabase('/rest/v1/rpc/nimbus_take_rpd',{method:'POST',token:session.access,payload:{p_cost:cost,p_request_id:requestId}});
  if(!rpc.ok) return {ok:false,http:503,error_code:'QUOTA_SERVICE_UNAVAILABLE'};
  const data=rpc.data;
  if(!data?.ok) return {ok:false,http:data?.duplicate?409:429,error_code:data?.duplicate?'DUPLICATE_REQUEST_ID':'NIMBUS_DAILY_LIMIT_REACHED',usage:data};
  return {ok:true,session,usage:data};
}
export async function readRpd(req,res) {
  const session=await currentSession(req,res);
  if (!session) return {ok:false,http:401,error_code:'NIMBUS_SIGN_IN_REQUIRED'};
  const day=new Date().toISOString().slice(0,10);
  const params=`?select=used&usage_day=eq.${day}&limit=1`;
  const r=await requestSupabase('/rest/v1/nimbus_daily_usage'+params,{token:session.access});
  if(!r.ok || !Array.isArray(r.data))return {ok:false,http:503,error_code:'QUOTA_SERVICE_UNAVAILABLE'};
  const used=Math.max(0,Number(r.data[0]?.used||0));
  return {ok:true,used,remaining:Math.max(0,DAILY_LIMIT-used),limit:DAILY_LIMIT,day,reset_timezone:'UTC'};
}
