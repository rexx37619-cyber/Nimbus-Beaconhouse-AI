import { GoogleGenAI } from '@google/genai';

function parseBody(req){if(typeof req.body==='string'){try{return JSON.parse(req.body||'{}')}catch{return {}}}return req.body||{}}

function svgFallback(title='Study Visual',topic='Study topic'){
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const t=String(topic).replace(/\s+/g,' ').slice(0,80);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#f8fbff"/><stop offset="1" stop-color="#eef4ff"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-opacity=".14"/></filter><marker id="arr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#334155"/></marker></defs><rect width="1200" height="675" rx="28" fill="url(#bg)"/><g filter="url(#shadow)"><rect x="42" y="34" width="1116" height="607" rx="30" fill="#fff"/></g><text x="78" y="92" font-family="Arial" font-size="17" font-weight="800" fill="#2563eb">NIMBUS • GRADE 7 STUDY VISUAL</text><text x="78" y="137" font-family="Arial" font-size="32" font-weight="900" fill="#0f172a">${esc(title)}</text><text x="78" y="166" font-family="Arial" font-size="14" fill="#64748b">High-clarity fallback • keywords • relationships • concise labels</text><circle cx="600" cy="355" r="105" fill="#dbeafe" stroke="#2563eb" stroke-width="5"/><circle cx="600" cy="355" r="64" fill="#eff6ff" stroke="#60a5fa" stroke-width="3"/><text x="600" y="347" text-anchor="middle" font-family="Arial" font-size="19" font-weight="900" fill="#1e3a8a">CORE</text><text x="600" y="375" text-anchor="middle" font-family="Arial" font-size="14" fill="#334155">${esc(t.slice(0,34))}</text><g font-family="Arial"><path d="M510 300 L305 230 H190" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="178" y="216" text-anchor="end" font-size="17" font-weight="800" fill="#0f172a">KEY CONCEPT</text><text x="178" y="238" text-anchor="end" font-size="12" fill="#64748b">Definition / structure</text><path d="M510 410 L305 490 H190" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="178" y="477" text-anchor="end" font-size="17" font-weight="800" fill="#0f172a">FUNCTION</text><text x="178" y="499" text-anchor="end" font-size="12" fill="#64748b">What it does</text><path d="M690 300 L895 230 H1010" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="1022" y="216" font-size="17" font-weight="800" fill="#0f172a">EXAMPLE</text><text x="1022" y="238" font-size="12" fill="#64748b">Relevant instance</text><path d="M690 410 L895 490 H1010" stroke="#334155" stroke-width="3" fill="none" marker-end="url(#arr)"/><text x="1022" y="477" font-size="17" font-weight="800" fill="#0f172a">RELATIONSHIP</text><text x="1022" y="499" font-size="12" fill="#64748b">Cause / effect / link</text></g><text x="600" y="602" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">Use the visual as study help, then rephrase explanations in your own words.</text></svg>`;
}

function imagePrompt(prompt){
  return `Create a high-quality 16:9 Grade 7 educational science visual for Nimbus Beaconhouse AI. Use the topic and answer context below. The visual must look like a polished textbook-quality scientific illustration, not a generic infographic. Prefer a central real scientific subject, anatomical cutaway, physical setup, process diagram, or clearly staged scientific sequence as appropriate. Use depth, clean lighting, accurate spatial relationships, readable short labels, leader lines, arrows, and a restrained professional school-science palette. Keep labels to short keywords, never paragraphs. Do not invent scientific structures or labels. Do not use a plain grid, empty placeholders, or a generic set of four boxes. Make the composition presentation-ready at 2K. Topic/request: ${String(prompt || '').slice(0,5000)}`;
}

async function generate(apiKey, model, prompt, aspectRatio, imageSize){
  const ai=new GoogleGenAI({apiKey});
  const interaction=await ai.interactions.create({
    model,
    input:imagePrompt(prompt),
    response_format:{type:'image',mime_type:'image/png',aspect_ratio:aspectRatio,image_size:imageSize},
    store:false
  });
  const image=interaction?.output_image;
  if(image?.data)return {data:image.data,mimeType:image.mime_type||image.mimeType||'image/png'};
  return null;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method Not Allowed'});
  try{
    const body=parseBody(req);
    const prompt=String(body.prompt||'').trim();
    if(!prompt)return res.status(400).json({ok:false,message:'No visual prompt was provided.'});
    const ratio=['16:9','1:1','4:3','3:4','9:16','21:9'].includes(String(body.aspectRatio||'16:9'))?String(body.aspectRatio||'16:9'):'16:9';
    const size=['512','1K','2K','4K'].includes(String(body.imageSize||'2K'))?String(body.imageSize||'2K'):'2K';
    const apiKey=process.env.GEMINI_API_KEY;
    if(apiKey){
      for(const model of ['gemini-3.1-flash-image','gemini-2.5-flash-image']){
        try{
          const image=await generate(apiKey,model,prompt,ratio,size);
          if(image)return res.status(200).json({ok:true,mimeType:image.mimeType,data:image.data,model});
        }catch(e){console.warn('[Nimbus visual] model unavailable:',model,e?.message||e)}
      }
    }
    const svg=Buffer.from(svgFallback('Study Visual',prompt)).toString('base64');
    return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:svg,model:'nimbus-science-fallback'});
  }catch(e){
    console.error('[Nimbus visual handler]',e);
    const svg=Buffer.from(svgFallback('Study Visual','Educational concept map')).toString('base64');
    return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:svg,model:'nimbus-science-fallback'});
  }
}
