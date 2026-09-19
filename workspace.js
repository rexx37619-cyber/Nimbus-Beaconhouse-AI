const FINANCE_KEY='nimbus_workspace_finance_v3';
const LAYOUT_KEY='nimbus_workspace_layout_v3';
const AGENT_HISTORY_KEY='nimbus_private_agent_chats_v3';
const DEFAULTS={accent:'#6d5dfc',accent2:'#22b8cf',radius:18,sidebar:286,density:'balanced',font:'Plus Jakarta Sans'};
const PREMIUM_LABEL='Nimbus 5.7 Lor • Ultra Modified';
const PREMIUM_MODEL_ID='gpt-6-astra';
const USD_TO_PKR_DEFAULT=277.27;
const GITHUB_OWNER='rexx37619-cyber';
const GITHUB_REPO='Nimbus-Beaconhouse-AI';
const GITHUB_BRANCH='main';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={role:'owner',user:null,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};
let currentFile={path:'',content:''};
let openAIModels=[];
let agentChats=JSON.parse(localStorage.getItem(AGENT_HISTORY_KEY)||'[]');
let currentAgentChatId=null;
function isOwner(){return true;}
function guardOwners(){document.querySelectorAll('.owner-only,.owner-only-panel').forEach(el=>el.classList.remove('hidden'));}
async function getPuterUser(){if(!window.puter)throw new Error('Puter.js did not load.');if(!puter.auth.isSignedIn())return null;return puter.auth.getUser();}
function openWorkspace(){document.getElementById('gate')?.classList.add('hidden');document.getElementById('workspace')?.classList.remove('hidden');}
function showDenied(msg){const el=document.getElementById('gateMsg');if(el){el.textContent=msg||'Please sign in with Puter.';el.style.color='#d74764';}}
async function signIn(){const b=document.getElementById('signInBtn');b.disabled=true;try{const signResult=await puter.auth.signIn();const u=await getPuterUser().catch(()=>({username:signResult?.username||'Puter account'}));session={role:'owner',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};document.getElementById('userEmail').textContent=u.email||u.username||'Puter account';document.getElementById('rolePill').textContent='ACCESS ALLOWED';document.getElementById('roleNote').textContent='Puter authenticated';document.getElementById('gateMsg').textContent='Access allowed — Puter account authenticated.';openWorkspace();guardOwners();await bootWorkspace();}catch(e){showDenied(e.message||'Puter sign-in required.')}finally{b.disabled=false;}}
document.getElementById('signInBtn').onclick=signIn;

function activateTab(tab){
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`tab-${tab}`));
  const panel=document.getElementById(`tab-${tab}`);
  panel?.scrollIntoView({block:'start'});
}
document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>{
  btn.addEventListener('click',()=>activateTab(btn.dataset.tab));
});

const WORKSPACE_MODELS=[
  {key:'gpt6', id:'gpt-6-astra', provider:'openai', label:'Nimbus 5.7 Lor • Ultra Modified', sub:'GPT-6 Astra • workspace premium'},
  {key:'fable51', id:'claude-fable-5-1', provider:'claude', label:'Nimbus Fable 5.1 • Ultra Modified', sub:'Claude Fable 5.1 • workspace premium'},
  {key:'nano', id:'nano-banana-2', provider:'gemini', kind:'image', label:'Nano Banana 2 • Visuals', sub:'2K study diagrams • posters • flowcharts'}
];
const DEFAULT_WORKSPACE_MODEL='gpt-6-astra';
let agentModels=[...WORKSPACE_MODELS];
let resolvedPuterModels=new Map();
function modelId(m){return String(m?.id||'').trim();}
function shortId(m){return modelId(m).split('/').pop().toLowerCase();}
function nimbusModelName(m){return m?.label||String(m?.name||m?.id||'Model');}
function updateModelBadge(id){const m=agentModels.find(x=>x.id===String(id)||x.resolvedId===String(id));$('agentModelState').textContent=m?nimbusModelName(m):'Nimbus model';}
function selectedModel(){return $('openaiModelSelect')?.value||DEFAULT_WORKSPACE_MODEL;}
function selectedAgentModel(){return agentModels.find(m=>m.id===selectedModel())||agentModels[0];}
async function loadAgentModels(){
  const select=$('openaiModelSelect');
  if(!select) return;
  select.innerHTML='';
  agentModels=WORKSPACE_MODELS.map(m=>({...m}));
  try{
    const models=window.puter?.ai?.listModels?await puter.ai.listModels():[];
    const list=Array.isArray(models)?models:[];
    for(const target of agentModels.filter(m=>m.kind!=='image')){
      const candidates=list.filter(m=>{
        const id=shortId(m); const provider=String(m.provider||'').toLowerCase();
        return provider===target.provider && (id===target.id || id===`${target.id}:free` || id===target.id.replace(/^gpt-/,'gpt-') || (target.key==='fable51' && /fable.?5.?1/i.test(id)));
      });
      const free=candidates.find(m=>shortId(m).endsWith(':free') || Number(m?.cost?.input||0)===0 && Number(m?.cost?.output||0)===0);
      const exact=candidates.find(m=>shortId(m)===target.id);
      target.resolvedId=free?.id || exact?.id || candidates[0]?.id || null;
      target.freeAvailable=!!free;
    }
  }catch{}
  const group=document.createElement('optgroup');group.label='Workspace models';
  for(const m of agentModels){
    const o=document.createElement('option');o.value=m.id;o.textContent=m.label;group.appendChild(o);
  }
  select.appendChild(group);
  const saved=agentChats.find(c=>c.id===currentAgentChatId)?.model||DEFAULT_WORKSPACE_MODEL;
  select.value=agentModels.some(m=>m.id===saved)?saved:DEFAULT_WORKSPACE_MODEL;
  updateModelBadge(select.value);
}
$('openaiModelSelect')?.addEventListener('change',()=>{updateModelBadge(selectedModel());const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=selectedModel();saveAgentChats();}});
function getResolvedModel(target){return target?.kind==='image'?null:(target?.resolvedId||null);}
function isFreeResolvedModel(target){return target?.kind==='image'||target?.freeAvailable===true;}

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)));}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:selectedModel(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();renderAgentHistory();startAgentChat(id);return id;}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';agentChats.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.onclick=()=>startAgentChat(c.id);box.appendChild(b);});}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c){newAgentChat();return;}currentAgentChatId=c.id;$('agentMessages').innerHTML='';(c.messages||[]).forEach(m=>renderSavedAgentMessage(m.role,m.text));if($('openaiModelSelect')){$('openaiModelSelect').value=c.model||selectedModel();updateModelBadge($('openaiModelSelect').value);}renderAgentHistory();}
function renderSavedAgentMessage(role,text){const el=document.createElement('div');el.className='agent-msg '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages').appendChild(el);}
function saveCurrentAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages.push({role,text});if(role==='me'&&c.title==='New private chat')c.title=text.slice(0,44)+(text.length>44?'…':'');c.model=selectedModel();saveAgentChats();renderAgentHistory();}
function appendAgent(role,text,save=true){const el=document.createElement('div');el.className='agent-msg '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight;if(save)saveCurrentAgentMessage(role,text);return el;}

function appendAgentImage(img){const host=$('agentMessages');if(!host)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const image=img instanceof HTMLImageElement?img:document.createElement('img');if(!(img instanceof HTMLImageElement)){if(typeof img==='string')image.src=img;else if(img?.src)image.src=img.src;else return;}image.alt='Nano Banana 2 generated visual';image.className='agent-generated-image';wrap.appendChild(image);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
function workspaceSvgFallback(title,keywords,type='diagram'){const items=String(keywords||'key concept • input • process • output').split(/[,•|]/).map(x=>x.trim()).filter(Boolean).slice(0,6);const safe=x=>String(x).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const nodes=items.map((x,i)=>{const y=145+i*70;return `<g><rect x=\"130\" y=\"${y}\" width=\"764\" height=\"46\" rx=\"14\" fill=\"#ffffff\" stroke=\"#cfd6e4\"/><text x=\"512\" y=\"${y+29}\" text-anchor=\"middle\" font-family=\"Arial\" font-size=\"17\" font-weight=\"700\" fill=\"#1f2430\">${safe(x)}</text>${i<items.length-1?`<line x1=\"512\" y1=\"${y+46}\" x2=\"512\" y2=\"${y+64}\" stroke=\"#6d5dfc\" stroke-width=\"4\"/><polygon points=\"512,${y+69} 505,${y+57} 519,${y+57}\" fill=\"#6d5dfc\"/>`:''}</g>`;}).join('');const svg=`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1024\" height=\"576\" viewBox=\"0 0 1024 576\"><rect width=\"1024\" height=\"576\" fill=\"#f7f8fc\"/><rect x=\"22\" y=\"22\" width=\"980\" height=\"532\" rx=\"24\" fill=\"#ffffff\" stroke=\"#e1e6ef\"/><text x=\"50\" y=\"60\" font-family=\"Arial\" font-size=\"13\" font-weight=\"800\" letter-spacing=\"2\" fill=\"#6d5dfc\">NIMBUS • STUDY ${safe(String(type).toUpperCase())}</text><text x=\"50\" y=\"96\" font-family=\"Arial\" font-size=\"24\" font-weight=\"800\" fill=\"#1f2430\">${safe(title||'Study visual')}</text>${nodes}</svg>`;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
function extractText(resp){const content=resp?.message?.content??resp?.content??resp?.text??'';if(typeof content==='string')return content;if(Array.isArray(content))return content.map(p=>typeof p==='string'?p:(p?.text||p?.content||'')).filter(Boolean).join('\n');return ''}
function renderAgentRichMessage(el,text){el.innerHTML='';const src=String(text||'').replace(/\r\n/g,'\n');const parts=src.split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);for(let i=0;i<parts.length;i+=3){const before=parts[i]||'';if(before){const p=document.createElement('div');p.className='rich-prose';p.textContent=before;el.appendChild(p);}const lang=parts[i+1];const code=parts[i+2];if(code!==undefined){const wrap=document.createElement('div');wrap.className='rich-code-wrap';const head=document.createElement('div');head.className='rich-code-head';const label=document.createElement('span');label.textContent=(lang||'text').toLowerCase();const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';const pre=document.createElement('pre');pre.textContent=code.replace(/^\n/,'').replace(/\n$/,'');copy.onclick=async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900);}catch{}};head.append(label,copy);wrap.append(head,pre);el.appendChild(wrap);}}}
function thinkingDots(){const el=document.createElement('div');el.className='agent-thinking';el.innerHTML='<span></span><span></span><span></span>';return el;}
$('agentForm').onsubmit=async e=>{
  e.preventDefault();
  const text=$('agentInput').value.trim();
  if(!text)return;
  if(!currentAgentChatId)newAgentChat();
  appendAgent('me',text);
  $('agentInput').value='';
  $('agentRunBtn').disabled=true;
  const dots=thinkingDots();
  $('agentMessages').appendChild(dots);
  $('agentMessages').scrollTop=$('agentMessages').scrollHeight;
  try{
    if(!window.puter)throw new Error('Puter.js did not load.');
    if(!puter.auth.isSignedIn())await puter.auth.signIn();
    const modelInfo=selectedAgentModel();
    if(modelInfo.kind==='image'){
      const visualPrompt=`Create a premium 16:9 educational poster/infographic, not a plain text chart. Use rich color, polished graphic design, realistic or high-quality 3D illustrative visuals, depth, soft shadows, clear hierarchy, accurate subject illustrations, meaningful icons, colored nodes, clean arrows and labeled callouts. Make the composition look like a professional school science poster or polished game/system infographic. Do NOT make a white page with only text boxes. Use concise keywords and short labels, never long paragraphs. Topic/request: ${text}. If it is code or game development, visualize the actual logic, system architecture, mechanics, entities and flow using distinctive colored components and illustrative icons. Output one cohesive finished visual suitable for a student study aid.`;
      try{
        const vr=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:visualPrompt,aspectRatio:'16:9',imageSize:'1K'})});
        const vd=await vr.json().catch(()=>({}));
        dots.remove();
        if(vr.ok&&vd.ok&&vd.data){appendAgent('ai','Nano Banana 2 visual generated. Use the keywords and labels shown, then rephrase explanations in your own words.');appendAgentImage(`data:${vd.mimeType||'image/png'};base64,${vd.data}`);}
        else {appendAgent('ai',vd.message||'Nano Banana 2 is unavailable. Nimbus generated a local study diagram instead.');appendAgentImage(workspaceSvgFallback(text,'keywords • inputs • process • outputs','diagram'));}
      }catch{dots.remove();appendAgent('ai','Nano Banana 2 is unavailable. Nimbus generated a local study diagram instead.');appendAgentImage(workspaceSvgFallback(text,'keywords • inputs • process • outputs','diagram'));}
    }else{
      const target=selectedAgentModel();
      if(!target?.resolvedId){
        dots.remove();
        appendAgent('ai',`${target?.label||'Selected model'} is not currently exposed by Puter for this workspace account. No request was sent.`);
        return;
      }
      if(!isFreeResolvedModel(target)){
        dots.remove();
        appendAgent('ai',`${target.label} is a premium Puter model and this workspace is configured to use free variants only. Puter did not expose a free variant for this model, so no chargeable request was sent.`);
        return;
      }
      const system=`You are Nimbus 5.7 Lor • Ultra Modified, a private educational workspace agent.
STYLE: No ** bold markers. Do not use Markdown # headings. Keep responses direct.
STUDENT WORK: For school answers, notes, assignments, essays, or paragraphs, give factual keywords, key points, structure, and concepts rather than polished submission-ready prose. If the user asks you to rewrite or rephrase an answer, say: "Please rephrase it in your own words." Then provide the information/keywords and a suggested structure, not a ready-to-submit paragraph.
VISUALS: When a diagram, flowchart, concept map, or game/system visual is useful, provide concise keywords and a Nano Banana 2-ready visual prompt.
CODING: Always put code in fenced Markdown blocks with a real language identifier. Explain code outside the fence.`;
      const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:getResolvedModel(target),normalize:true,stream:false});
      dots.remove();
      appendAgent('ai',extractText(resp)||'No text response was returned.');
    }
  }catch(err){
    dots.remove();
    appendAgent('ai','Nimbus is temporarily unavailable. Please try again in a moment.');
    console.error(err);
  }finally{$('agentRunBtn').disabled=false;}
};
$('newAgentChat').onclick=()=>newAgentChat();$('clearAgentChats').onclick=()=>{agentChats=[];saveAgentChats();currentAgentChatId=null;$('agentMessages').innerHTML='';newAgentChat();};

function loadFinance(){const d=JSON.parse(localStorage.getItem(FINANCE_KEY)||'{}');$('revenueInput').value=d.revenueUSD??'';$('expenseInput').value=d.expensesUSD??'';$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance();}
function renderFinance(){const usd=Number($('revenueInput').value||0),exp=Number($('expenseInput').value||0),rate=Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT),revenue=usd*rate,profit=(usd-exp)*rate;$('revenueText').textContent=`PKR ${Math.round(revenue).toLocaleString()}`;$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;$('marginText').textContent=`${usd?((profit/revenue)*100).toFixed(1):0}% margin`;$('revenueBar').style.width=(revenue?Math.min(100,Math.max(0,profit/revenue*100)):0)+'%';}
['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id).addEventListener('input',renderFinance));$('saveFinance').onclick=()=>{localStorage.setItem(FINANCE_KEY,JSON.stringify({revenueUSD:Number($('revenueInput').value||0),expensesUSD:Number($('expenseInput').value||0),rate:Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT)}));renderFinance();};loadFinance();

async function loadRepoFiles(){if(!isOwner())return;try{const r=await fetch('/api/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not sync important repo files.');$('fileSelect').innerHTML=(d.files||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');$('fileCount').textContent=`${(d.files||[]).length} important repo files`;$('fileMsg').textContent=`Synced from ${d.owner}/${d.repo} @ ${d.branch}`;}catch(e){$('fileMsg').textContent=e.message||'Could not sync repo files.';}}
async function loadFile(path){const safe=String(path||'').replace(/^\/+/, '');if(!safe||safe.includes('..'))throw new Error('Invalid file path.');const r=await fetch('/api/project-file?path='+encodeURIComponent(safe));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not load file.');currentFile={path:d.path,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path}`;}
$('loadFile').onclick=async()=>{try{await loadFile($('fileSelect').value);}catch(e){$('fileMsg').textContent=e.message||'Could not load file.';}};$('refreshFiles').onclick=loadRepoFiles;$('saveFile').onclick=()=>{const path=currentFile.path||$('fileSelect').value;const content=$('fileEditor').value;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('fileMsg').textContent=`Downloaded ${path}. Replace it in Nimbus_CLEAN, then git add, commit and push.`;};

function readLayout(){const d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null')||DEFAULTS;$('accentInput').value=d.accent||DEFAULTS.accent;$('radiusInput').value=d.radius||DEFAULTS.radius;$('sidebarInput').value=d.sidebar||DEFAULTS.sidebar;$('densityInput').value=d.density||DEFAULTS.density;return d;}
function getLayout(){return{accent:$('accentInput').value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput').value||18),sidebar:Number($('sidebarInput').value||286),density:$('densityInput').value||'balanced',font:DEFAULTS.font};}
function applyFrameLayout(){const frame=$('sitePreview');if(!frame)return;try{const doc=frame.contentDocument;if(!doc)return;const d=getLayout();doc.documentElement.style.setProperty('--nimbus-accent',d.accent);doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');doc.body.dataset.nimbusDensity=d.density;doc.body.style.fontFamily=`"${d.font}",Inter,system-ui,sans-serif`;doc.getElementById('__nimbus_preview_badge')?.remove();const badge=doc.createElement('div');badge.id='__nimbus_preview_badge';badge.textContent='LIVE UI PREVIEW';Object.assign(badge.style,{position:'fixed',right:'12px',top:'12px',zIndex:'2147483647',padding:'6px 9px',borderRadius:'999px',background:d.accent,color:'#fff',font:'800 10px Arial'});doc.body.appendChild(badge);}catch(e){console.warn(e);}}
$('sitePreview')?.addEventListener('load',applyFrameLayout);function saveLayoutLocal(){const d=getLayout();localStorage.setItem(LAYOUT_KEY,JSON.stringify(d));return d;}$('applyLayout').onclick=()=>{saveLayoutLocal();applyFrameLayout();$('layoutMsg').textContent='Preview updated.';};$('publishLayout').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(saveLayoutLocal(),null,2)],{type:'application/json'}));a.download='site-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN and push main.';};$('resetLayout').onclick=()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();$('layoutMsg').textContent='Preview reset.';};readLayout();

async function bootWorkspace(){activateTab('overview');await loadRepoFiles();await loadAgentModels();renderAgentHistory();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);}
if(window.puter?.auth?.isSignedIn?.()){getPuterUser().then(async u=>{if(!u)return;session={role:'owner',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};document.getElementById('userEmail').textContent=u.email||u.username||'Puter account';document.getElementById('rolePill').textContent='ACCESS ALLOWED';document.getElementById('roleNote').textContent='Puter authenticated';openWorkspace();guardOwners();bootWorkspace();}).catch(()=>{});}
