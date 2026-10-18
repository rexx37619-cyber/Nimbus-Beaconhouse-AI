// Nimbus V31 Pollinations image failover. Same client response contract as V29.1.
// All keys stay on the server. No legacy FLUX fallback.
const BASE='https://gen.pollinations.ai';
const ALLOWED_MODELS=['openai/gpt-image-2','openai/gpt-image-1.5','openai/gpt-image-1-mini'];
const MAX_IMAGE_BYTES=3*1024*1024; // 3 MiB => ~4 MiB base64, below Vercel's 4.5MB response limit.
const MAX_ATTEMPTS=3;
const REQUEST_TIMEOUT_MS=17000;
const MAX_TOTAL_MS=51000;
const perIp=new Map(); // best-effort per-instance throttle; not cross-instance storage.
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
function throttle(ip){
 const now=Date.now();if(perIp.size>3000)perIp.clear();
 const key=String(ip||'unknown').slice(0,70);let r=perIp.get(key)||{count:0,at:now};
 if(now-r.at>600000)r={count:0,at:now};
 r.count++;perIp.set(key,r);return r.count<=30;
}
function models(){
 const preferred=String(process.env.POLLINATIONS_IMAGE_MODELS||'').split(',').map(s=>s.trim()).filter(x=>ALLOWED_MODELS.includes(x));
 return [...new Set([...preferred,...ALLOWED_MODELS])].slice(0,MAX_ATTEMPTS);
}
function errorResponse(res,status,code,providerStatus,attempts){
 return res.status(status).json({ok:false,fallback:false,model:'pollinations',error_code:code,provider_status:providerStatus||null,attempted_models:attempts});
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error_code:'METHOD_NOT_ALLOWED'});
 const key=String(process.env.POLLINATIONS_API_KEY||'').trim();
 if(!key)return errorResponse(res,503,'MISSING_POLLINATIONS_API_KEY',null,[]);
 const size=Number(req.headers?.['content-length']||0);
 if(size>7000)return errorResponse(res,413,'VISUAL_REQUEST_TOO_LARGE',null,[]);
 const ip=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
 if(!throttle(ip))return errorResponse(res,429,'VISUAL_RATE_LIMIT',null,[]);
 let body=req.body||{};
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{return errorResponse(res,400,'INVALID_JSON',null,[]);}}
 if(!body||typeof body!=='object'||Array.isArray(body))return errorResponse(res,400,'INVALID_REQUEST_BODY',null,[]);
 const prompt=String(body.prompt||'').trim();
 if(!prompt||prompt.length>3500)return errorResponse(res,400,'INVALID_VISUAL_PROMPT',null,[]);
 const visualPrompt=(prompt.slice(0,1400)+' Student-friendly educational visual, strong subject-specific imagery, almost no text, no paragraphs.').trim();
 const start=Date.now(), attempts=[],chain=models();
 for(const model of chain){
   if(Date.now()-start>MAX_TOTAL_MS-4000)break;
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),Math.min(REQUEST_TIMEOUT_MS,MAX_TOTAL_MS-(Date.now()-start)));
   try{
     const uri=`${BASE}/image/${encodeURIComponent(visualPrompt)}?model=${encodeURIComponent(model)}&width=1280&height=720`;
     const upstream=await fetch(uri,{method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'image/png,image/jpeg,image/webp'},signal:controller.signal,redirect:'error'});
     attempts.push(model);
     if(!upstream.ok){
       if([400,401,402,403].includes(upstream.status))return errorResponse(res,502,'POLLINATIONS_ACCOUNT_OR_REQUEST_ERROR',upstream.status,attempts);
       if(![408,409,425,429,500,502,503,504].includes(upstream.status))return errorResponse(res,502,'POLLINATIONS_PROVIDER_ERROR',upstream.status,attempts);
       if(Date.now()-start<MAX_TOTAL_MS-7000)await sleep(180);
       continue;
     }
     const mime=(upstream.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
     if(!['image/png','image/jpeg','image/webp'].includes(mime))continue;
     if(Number(upstream.headers.get('content-length')||0)>MAX_IMAGE_BYTES)continue;
     const bytes=Buffer.from(await upstream.arrayBuffer());
     if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)continue;
     // Reject empty/non-image bodies with misleading media type.
     const png=bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
     const jpg=bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
     const webp=bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
     if(!(png||jpg||webp))continue;
     return res.status(200).json({ok:true,skipped:false,fallback:model!==chain[0],model,data:bytes.toString('base64'),mimeType:mime});
   }catch(e){attempts.push(model);if(!['AbortError','TimeoutError','TypeError'].includes(String(e?.name)))return errorResponse(res,502,'POLLINATIONS_NETWORK_ERROR',null,attempts);}
   finally{clearTimeout(timer);}
 }
 return errorResponse(res,502,'POLLINATIONS_ALL_MODELS_UNAVAILABLE',null,attempts);
}
