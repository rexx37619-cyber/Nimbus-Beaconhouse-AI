/* Nimbus V34.6.6: no Supabase in the public learning path.
   This serverless in-memory limit is per runtime instance, NOT globally atomic.
   For a genuine shared quota, configure a durable rate-limit data store. */
export const DAILY_LIMIT=50;
const counters=new Map();
let bucketDay='';
let totalUsed=0;
const recentIds=new Set();
export function allowedOrigin(req){
  const origin=req.headers?.origin;
  if(!origin)return true;
  try{const a=new URL(origin);return ['http:','https:'].includes(a.protocol)&&a.host.toLowerCase()===String(req.headers?.host||'').toLowerCase()}
  catch{return false}
}
export async function reserveRpd(req,res,body){
  const id=String(body?.client_request_id||'');
  if(!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(id))return {ok:false,http:400,error_code:'INVALID_REQUEST_ID'};
  const day=new Date().toISOString().slice(0,10);
  if(day!==bucketDay){bucketDay=day;totalUsed=0;counters.clear();recentIds.clear()}
  if(recentIds.has(id))return {ok:false,http:409,error_code:'DUPLICATE_REQUEST_ID'};
  const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,90);
  const count=counters.get(ip)||0;
  if(totalUsed>=DAILY_LIMIT||count>=DAILY_LIMIT)return {ok:false,http:429,error_code:'NIMBUS_DAILY_LIMIT_REACHED',usage:{used:totalUsed,cost:1,limit:50}};
  totalUsed++;counters.set(ip,count+1);recentIds.add(id);
  if(recentIds.size>2000)recentIds.clear();
  return {ok:true,usage:{used:totalUsed,cost:1,limit:50,day}};
}
