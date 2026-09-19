function parseBody(req){
  if(typeof req.body==='string'){try{return JSON.parse(req.body||'{}')}catch{return {}}}
  return req.body||{}
}
function extractGenerateContentImage(data){
  const parts=data?.candidates?.[0]?.content?.parts||[];
  for(const part of parts){
    const blob=part?.inlineData||part?.inline_data;
    if(blob?.data)return {data:blob.data,mimeType:blob.mimeType||blob.mime_type||'image/png'};
  }
  return null;
}
function extractInteractionImage(data){
  if(data?.output_image?.data)return {data:data.output_image.data,mimeType:data.output_image.mime_type||data.output_image.mimeType||'image/png'};
  for(const step of data?.steps||[]){
    if(step?.type!=='model_output')continue;
    for(const block of step?.content||[]){
      if(block?.type==='image'&&block?.data)return {data:block.data,mimeType:block.mime_type||block.mimeType||'image/png'};
    }
  }
  return null;
}
function professionalPrompt(prompt){
  return `Create a professional, realistic educational visual for this request: ${prompt}\n\nVISUAL DIRECTION: realistic subject imagery, polished textbook/poster quality, rich natural color, strong contrast, dimensional lighting, depth, accurate visual relationships, meaningful icons or object illustrations, clean composition, elegant typography, short readable labels, precise leader lines/callouts, arrows only where genuinely useful, strong visual hierarchy, presentation-ready 16:9 composition.\n\nIf the topic is anatomy or science, use a detailed realistic or high-quality 3D cutaway/illustration of the actual subject with labeled structures. If the topic is a process, show the real objects or stages with visual cues and a refined flow, not generic colored boxes. If the topic is code/game development, visualize the architecture, systems, interactions, mechanics, or flow with meaningful illustrated components.\n\nNEVER produce a generic three-box template, blank placeholders, a plain text poster, a wireframe, or a basic arrow diagram. Avoid large paragraphs. Use concise labels only. Make the final visual look like a professionally designed educational infographic or textbook plate.`
}
async function callInteractions(apiKey,prompt){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({model:'gemini-3.1-flash-image',input:[{type:'text',text:professionalPrompt(prompt)}],response_format:{type:'image',mime_type:'image/png',aspect_ratio:'16:9',image_size:'2K'}})
  });
  const d=await r.json().catch(()=>({}));
  return {r,d,image:extractInteractionImage(d)};
}
async function callGenerateContent(apiKey,prompt,model='gemini-3.1-flash-image'){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{parts:[{text:professionalPrompt(prompt)}]}],generationConfig:{responseModalities:['IMAGE'],responseFormat:{image:{aspectRatio:'16:9',imageSize:'2K'}}}})
  });
  const d=await r.json().catch(()=>({}));
  return {r,d,image:extractGenerateContentImage(d)};
}
function escapeXml(s){return String(s).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;'}[c]||c))}
function makeFallbackSvg(topic){
  const t=escapeXml(String(topic||'Study Visual').slice(0,70));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset=".55" stop-color="#18253d"/><stop offset="1" stop-color="#1d1230"/></linearGradient><linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity=".04"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-opacity=".26"/></filter></defs><rect width="1600" height="900" fill="url(#bg)"/><circle cx="240" cy="160" r="180" fill="#22d3ee" opacity=".10"/><circle cx="1370" cy="760" r="250" fill="#8b5cf6" opacity=".12"/><text x="90" y="92" font-family="Arial" font-size="24" font-weight="700" fill="#67e8f9" letter-spacing="5">NIMBUS • EDUCATIONAL VISUAL</text><text x="90" y="160" font-family="Arial" font-size="52" font-weight="800" fill="#ffffff">${t}</text><g filter="url(#shadow)"><rect x="90" y="225" width="420" height="520" rx="30" fill="url(#card)" stroke="#38bdf8" stroke-opacity=".6"/><rect x="590" y="225" width="420" height="520" rx="30" fill="url(#card)" stroke="#a78bfa" stroke-opacity=".6"/><rect x="1090" y="225" width="420" height="520" rx="30" fill="url(#card)" stroke="#4ade80" stroke-opacity=".6"/></g><circle cx="300" cy="365" r="95" fill="#38bdf8" opacity=".20" stroke="#67e8f9" stroke-width="5"/><circle cx="800" cy="365" r="95" fill="#a78bfa" opacity=".20" stroke="#c4b5fd" stroke-width="5"/><circle cx="1300" cy="365" r="95" fill="#4ade80" opacity=".20" stroke="#86efac" stroke-width="5"/><text x="300" y="375" text-anchor="middle" font-family="Arial" font-size="32" font-weight="800" fill="#ffffff">INPUT</text><text x="800" y="375" text-anchor="middle" font-family="Arial" font-size="32" font-weight="800" fill="#ffffff">PROCESS</text><text x="1300" y="375" text-anchor="middle" font-family="Arial" font-size="32" font-weight="800" fill="#ffffff">OUTCOME</text><path d="M420 365 L590 365" stroke="#ffffff" stroke-width="7" opacity=".8"/><path d="M1020 365 L1090 365" stroke="#ffffff" stroke-width="7" opacity=".8"/><text x="300" y="500" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#e2e8f0">Key materials / causes</text><text x="300" y="545" text-anchor="middle" font-family="Arial" font-size="18" fill="#b7c5d9">concise study keywords</text><text x="800" y="500" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#e2e8f0">Main mechanism / steps</text><text x="800" y="545" text-anchor="middle" font-family="Arial" font-size="18" fill="#b7c5d9">visual relationships and sequence</text><text x="1300" y="500" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#e2e8f0">Result / significance</text><text x="1300" y="545" text-anchor="middle" font-family="Arial" font-size="18" fill="#b7c5d9">study-ready summary</text><text x="800" y="835" text-anchor="middle" font-family="Arial" font-size="16" fill="#94a3b8">Local fallback visual • generated topic structure</text></svg>`
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method Not Allowed'});
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey)return res.status(503).json({ok:false,message:'Visual generation is not configured.'});
  try{
    const body=parseBody(req);const prompt=String(body.prompt||'').trim();if(!prompt)return res.status(400).json({ok:false,message:'No visual prompt was provided.'});
    let attempt=await callInteractions(apiKey,prompt);
    if(attempt.r.ok&&attempt.image)return res.status(200).json({ok:true,mimeType:attempt.image.mimeType,data:attempt.image.data,source:'nano-banana-2'});
    attempt=await callGenerateContent(apiKey,prompt,'gemini-3.1-flash-image');
    if(attempt.r.ok&&attempt.image)return res.status(200).json({ok:true,mimeType:attempt.image.mimeType,data:attempt.image.data,source:'nano-banana-2'});
    attempt=await callGenerateContent(apiKey,prompt,'gemini-2.5-flash-image');
    if(attempt.r.ok&&attempt.image)return res.status(200).json({ok:true,mimeType:attempt.image.mimeType,data:attempt.image.data,source:'nano-banana'});
    const status=attempt.r?.status||502;const msg=attempt.d?.error?.message||'Image provider unavailable';console.error('[Nimbus visual]',status,msg);
    return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:Buffer.from(makeFallbackSvg(prompt),'utf8').toString('base64'),source:'svg-fallback',message:'A structured study visual was generated locally.'});
  }catch(err){
    console.error('[Nimbus visual exception]',err);return res.status(200).json({ok:true,fallback:true,mimeType:'image/svg+xml',data:Buffer.from(makeFallbackSvg('Study Visual'),'utf8').toString('base64'),source:'svg-fallback',message:'A structured study visual was generated locally.'});
  }
}
