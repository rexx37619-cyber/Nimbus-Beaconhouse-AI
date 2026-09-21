import { GoogleGenAI } from '@google/genai';

function parseBody(req){if(typeof req.body==='string'){try{return JSON.parse(req.body||'{}')}catch{return {}}}return req.body||{}}

function svgFallback(title='Study Visual',topic='Study topic'){
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const t=String(topic).replace(/\s+/g,' ').slice(0,90);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#f8fbff"/><stop offset="1" stop-color="#eef4ff"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-opacity=".14"/></filter><marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#334155"/></marker></defs><rect width="1200" height="675" rx="28" fill="url(#bg)"/><g filter="url(#shadow)"><rect x="42" y="34" width="1116" height="607" rx="30" fill="#fff"/></g><text x="78" y="92" font-family="Arial" font-size="17" font-weight="800" fill="#2563eb">NIMBUS • SCIENCE FALLBACK VISUAL</text><text x="78" y="138" font-family="Arial" font-size="30" font-weight="900" fill="#0f172a">${esc(title)}</text><text x="78" y="166" font-family="Arial" font-size="14" fill="#64748b">A clean study aid • short labels • visual relationships</text><circle cx="600" cy="355" r="112" fill="#e0f2fe" stroke="#0284c7" stroke-width="5"/><circle cx="600" cy="355" r="74" fill="#f0f9ff" stroke="#38bdf8" stroke-width="3"/><text x="600" y="347" text-anchor="middle" font-family="Arial" font-size="18" font-weight="900" fill="#0c4a6e">SCIENCE</text><text x="600" y="375" text-anchor="middle" font-family="Arial" font-size="12" fill="#334155">${esc(t.slice(0,38))}</text><g font-family="Arial"><path d="M510 286 L290 215 H170" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="158" y="205" text-anchor="end" font-size="16" font-weight="800" fill="#0f172a">KEY STRUCTURE</text><text x="158" y="225" text-anchor="end" font-size="12" fill="#64748b">Main part / feature</text><path d="M510 424 L290 500 H170" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="158" y="490" text-anchor="end" font-size="16" font-weight="800" fill="#0f172a">FUNCTION</text><text x="158" y="510" text-anchor="end" font-size="12" fill="#64748b">What it does</text><path d="M690 286 L910 215 H1030" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="1042" y="205" font-size="16" font-weight="800" fill="#0f172a">RELATIONSHIP</text><text x="1042" y="225" font-size="12" fill="#64748b">Cause / effect / link</text><path d="M690 424 L910 500 H1030" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="1042" y="490" font-size="16" font-weight="800" fill="#0f172a">EXAMPLE</text><text x="1042" y="510" font-size="12" fill="#64748b">Relevant instance</text></g><text x="600" y="602" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">Use this as study help, then rephrase the explanation in your own words.</text></svg>`;
}

function imagePrompt(prompt){
  return `Create an artistic, scientifically grounded Grade 7 educational visual for Nimbus Beaconhouse AI. Never use a generic four-box infographic, template flowchart, poster, UI card, empty grid, or plain text diagram. Instead choose the best visual form for the topic: realistic anatomy/cutaway, scientifically accurate object/structure, laboratory setup, staged process with real objects, or comparison plate. Use depth, dimensional lighting, subtle textures, clear hierarchy and a polished textbook/editorial illustration look. Keep any in-image labels extremely short (1–3 words), large and legible. Prefer leader lines/arrows only when useful. Do not invent facts, organs, structures, steps, measurements, or labels not supported by the prompt. 16:9 composition, high visual detail, educational and presentation-ready. Topic and answer context: ${String(prompt||'').slice(0,6000)}`;
}

async function generateGemini(apiKey,model,prompt,aspectRatio,imageSize){
  const ai=new GoogleGenAI({apiKey});
  const interaction=await ai.interactions.create({model,input:imagePrompt(prompt),response_format:{type:'image',mime_type:'image/png',aspect_ratio:aspectRatio,image_size:imageSize},store:false});
  const image=interaction?.output_image;
  if(image?.data)return {data:image.data,mimeType:image.mime_type||image.mimeType||'image/png',model};
  return null;
}

async function generateCloudflare(accountId,token,prompt){
  const url=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  const r=await fetch(url,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({prompt:imagePrompt(prompt).slice(0,2000),steps:8,seed:Math.floor(Math.random()*1000000000)})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.errors?.[0]?.message||`Cloudflare image request failed (${r.status})`);
  const b64=data?.result?.image||data?.image||data?.result?.output?.image;
  if(!b64) throw new Error('Cloudflare image response was empty.');
  return {data:b64,mimeType:'image/jpeg',model:'flux-1-schnell'};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method Not Allowed'});
  try{
    const body=parseBody(req);const prompt=String(body.prompt||'').trim();
    if(!prompt)return res.status(400).json({ok:false,message:'No visual prompt was provided.'});
    const ratio=['16:9','1:1','4:3','3:4','9:16','21:9'].includes(String(body.aspectRatio||'16:9'))?String(body.aspectRatio||'16:9'):'16:9';
    const size=['512','1K','2K','4K'].includes(String(body.imageSize||'2K'))?String(body.imageSize||'2K'):'2K';

    // Free-first visual path: Cloudflare Workers AI provides a daily free allocation and hosts FLUX.1 schnell.
    if(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN){
      try{const image=await generateCloudflare(process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_API_TOKEN,prompt);return res.status(200).json({ok:true,...image});}
      catch(e){console.warn('[Nimbus visual] Cloudflare FLUX unavailable:',e?.message||e)}
    }

    // Optional premium fallback when the existing Gemini key has image access.
    if(process.env.GEMINI_API_KEY){
      for(const model of ['gemini-3.1-flash-image']){
        try{const image=await generateGemini(process.env.GEMINI_API_KEY,model,prompt,ratio,size);if(image)return res.status(200).json({ok:true,...image});}
        catch(e){console.warn('[Nimbus visual] Gemini image unavailable:',model,e?.message||e)}
      }
    }

    const svg=Buffer.from(svgFallback('Study Visual',prompt)).toString('base64');
    return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:svg,model:'nimbus-science-fallback'});
  }catch(e){
    console.error('[Nimbus visual handler]',e);
    const svg=Buffer.from(svgFallback('Study Visual','Educational science concept')).toString('base64');
    return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:svg,model:'nimbus-science-fallback'});
  }
}
