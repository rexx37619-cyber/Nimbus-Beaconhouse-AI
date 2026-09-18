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
let session={role:'denied',user:null,permissions:[]};
let currentFile={path:'',content:''};
let openAIModels=[];
let agentChats=JSON.parse(localStorage.getItem(AGENT_HISTORY_KEY)||'[]');
let currentAgentChatId=null;

function setSecurity(text,kind='wait'){const el=$('securityBadge');if(!el)return;el.textContent=`SECURITY CHECK: ${text}`;el.style.color=kind==='ok'?'#0f9f72':kind==='bad'?'#d74764':'#b37a00';}
function isOwner(){return session.role==='owner';}
function guardOwners(){document.querySelectorAll('.owner-only,.owner-only-panel').forEach(el=>el.classList.toggle('hidden',!isOwner()));}
async function getPuterUser(){if(!window.puter)throw new Error('Puter.js did not load.');if(!puter.auth.isSignedIn())return null;return puter.auth.getUser();}
async function getPuterEmail(user){
  // Email permission is intentionally not required. Puter username/UUID are enough.
  return String(user?.email||'').trim().toLowerCase();
}
async function authorize(user){
  const email=await getPuterEmail(user);
  const puterUuid=String(user?.uuid||'').trim();
  const puterUsername=String(user?.username||user?.username_raw||'').trim().toLowerCase();
  if(!puterUuid) throw new Error('Please sign in with Puter first.');
  const r=await fetch('/api/workspace-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,puter_uuid:puterUuid,puter_username:puterUsername})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok) throw new Error(d.message||'Workspace access denied.');
  session={user,role:d.role,permissions:d.permissions||[]};
  $('userEmail').textContent=email||puterUsername||'Puter account'; $('rolePill').textContent='ACCESS ALLOWED'; $('roleNote').textContent='Puter account authenticated';
  $('overviewRole').textContent='Puter account'; $('securityRoleTag').textContent='ACCESS ALLOWED'; $('serverState').textContent='Allowed';
  $('permissionState').textContent=d.permissions.join(' • '); $('puterState').textContent='Authenticated'; guardOwners();
  return d;
}
function openWorkspace(){$('gate').classList.add('hidden');$('workspace').classList.remove('hidden');}
function showDenied(msg){$('gateMsg').textContent=msg;$('gateMsg').style.color='#d74764';setSecurity('DENIED','bad');}
async function signIn(){const b=$('signInBtn');b.disabled=true;setSecurity('CHECKING PUTER ACCOUNT');try{await puter.auth.signIn({request_auth:true});const u=await getPuterUser();await authorize(u);$('gateMsg').textContent='Access allowed — Puter account authenticated.';setSecurity('ACCESS ALLOWED','ok');openWorkspace();await bootWorkspace();}catch(e){showDenied(e.message||'Puter sign-in required.')}finally{b.disabled=false;}}
$('signInBtn').onclick=signIn;

const OPENAI_ALIASES={
  'gpt-6-astra':'Nimbus 5.7 Lor • Ultra Modified','gpt-5.6-sol':'Nimbus Sol 5.6 • Modified','gpt-5.6-terra':'Nimbus Terra 5.6 • Modified','gpt-5.6-luna':'Nimbus Luna 5.6 • Modified','gpt-5.5':'Nimbus ROR 5.5 • Modified','gpt-5.5-pro':'Nimbus ROR 5.5 Pro • Modified','gpt-5.4':'Nimbus ROR 5.4 • Modified','gpt-5.4-pro':'Nimbus ROR 5.4 Pro • Modified','gpt-5.4-mini':'Nimbus ROR Mini 5.4 • Modified','gpt-5.4-nano':'Nimbus ROR Nano 5.4 • Modified','gpt-5.3-codex':'Nimbus Code 5.3 • Modified','gpt-5.1':'Nimbus ROR 5.1 • Modified','gpt-5.1-chat':'Nimbus Chat 5.1 • Modified','gpt-5':'Nimbus ROR 5 • Modified','gpt-4.1':'Nimbus Classic 4.1 • Modified','gpt-4o':'Nimbus Omni 4o • Modified','gpt-4o-mini':'Nimbus Mini 4o • Modified'
};
const CLAUDE_ALIASES={'claude-fable-5-1':'Nimbus Fable 5.1 • Modified','claude-fable-5':'Nimbus Fable 5 • Modified','claude-opus-5':'Nimbus Opus 5 • Modified'};
const NANO_MODEL={id:'nano-banana-2',provider:'gemini',kind:'image',label:'Nano Banana 2 • Visuals',sub:'Diagrams • flowcharts • concept visuals'};
let agentModels=[];
function modelId(m){return String(m?.id||'').trim();}
function shortId(m){return modelId(m).split('/').pop().toLowerCase();}
function nimbusModelName(m){
  const id=shortId(m);
  if(m?.kind==='image') return NANO_MODEL.label;
  if(String(m?.provider).toLowerCase()==='claude' && CLAUDE_ALIASES[id]) return CLAUDE_ALIASES[id];
  if(String(m?.provider).toLowerCase()==='openai' && OPENAI_ALIASES[id]) return OPENAI_ALIASES[id];
  const raw=String(m?.name||m?.id||'Model').replace(/^Claude\s*/i,'').replace(/^GPT\s*/i,'').replace(/\s+/g,' ').trim();
  return `Nimbus ${raw} • Modified`;
}
function isChatProviderModel(m, provider){
  const p=String(m?.provider||provider||'').toLowerCase();
  const id=shortId(m);
  if(!['openai','claude'].includes(p)) return false;
  return !['image','live','audio','transcribe','embedding','embed','moderation','tts','realtime','speech'].some(x=>id.includes(x));
}
function sortModels(list, priority){
  return [...list].sort((a,b)=>{
    const ai=priority.indexOf(shortId(a)), bi=priority.indexOf(shortId(b));
    if(ai!==bi) return (ai<0?999:ai)-(bi<0?999:bi);
    return nimbusModelName(a).localeCompare(nimbusModelName(b));
  });
}
async function loadAgentModels(){
  const select=$('openaiModelSelect');
  if(!select) return;
  select.innerHTML='<option>Loading Nimbus models…</option>';
  try{
    let openai=[], claude=[];
    if(window.puter?.ai?.listModels){
      try{openai=await puter.ai.listModels('openai');}catch{openai=[];}
      try{claude=await puter.ai.listModels('claude');}catch{claude=[];}
    }
    openai=(openai||[]).filter(m=>isChatProviderModel(m,'openai'));
    claude=(claude||[]).filter(m=>isChatProviderModel(m,'claude'));
    const unique=(arr)=>{const seen=new Set();return arr.filter(m=>{const id=modelId(m);if(!id||seen.has(id))return false;seen.add(id);return true;});};
    openai=unique(openai); claude=unique(claude);
    agentModels=[NANO_MODEL,...sortModels(openai,['gpt-6-astra','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5-pro','gpt-5.5','gpt-5.4-pro','gpt-5.4','gpt-5.3-codex']),...sortModels(claude,['claude-fable-5-1','claude-fable-5','claude-opus-5','claude-sonnet-5','claude-opus-4-8','claude-opus-4-7','claude-opus-4-6'])];
    select.innerHTML='';
    const groups=[['Visual model',agentModels.filter(m=>m.kind==='image')],['OpenAI / ChatGPT',agentModels.filter(m=>String(m.provider).toLowerCase()==='openai')],['Anthropic / Claude',agentModels.filter(m=>String(m.provider).toLowerCase()==='claude')]];
    groups.forEach(([label,items])=>{if(!items.length)return;const g=document.createElement('optgroup');g.label=label;items.forEach(m=>{const o=document.createElement('option');o.value=modelId(m);o.textContent=nimbusModelName(m);g.appendChild(o);});select.appendChild(g);});
    if(!select.options.length){const o=document.createElement('option');o.value=NANO_MODEL.id;o.textContent=NANO_MODEL.label;select.appendChild(o);}
    const initial=agentChats.find(c=>c.id===currentAgentChatId)?.model || agentModels.find(m=>shortId(m)==='gpt-6-astra')?.id || agentModels.find(m=>String(m.provider)==='openai')?.id || NANO_MODEL.id;
    select.value=initial; updateModelBadge(initial);
  }catch{select.innerHTML=`<option value="${NANO_MODEL.id}">${NANO_MODEL.label}</option>`;select.value=NANO_MODEL.id;updateModelBadge(NANO_MODEL.id);}
}
function selectedModel(){return $('openaiModelSelect')?.value||NANO_MODEL.id;}
function selectedAgentModel(){return agentModels.find(m=>modelId(m)===selectedModel())||NANO_MODEL;}
function updateModelBadge(id){const m=agentModels.find(x=>modelId(x)===String(id));$('agentModelState').textContent=m?nimbusModelName(m):NANO_MODEL.label;}
$('openaiModelSelect')?.addEventListener('change',()=>{updateModelBadge(selectedModel());const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=selectedModel();saveAgentChats();}});

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)));}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:selectedModel(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();renderAgentHistory();startAgentChat(id);return id;}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';agentChats.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.onclick=()=>startAgentChat(c.id);box.appendChild(b);});}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c){newAgentChat();return;}currentAgentChatId=c.id;$('agentMessages').innerHTML='';(c.messages||[]).forEach(m=>renderSavedAgentMessage(m.role,m.text));if($('openaiModelSelect')){$('openaiModelSelect').value=c.model||selectedModel();updateModelBadge($('openaiModelSelect').value);}renderAgentHistory();}
function renderSavedAgentMessage(role,text){const el=document.createElement('div');el.className='agent-msg '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages').appendChild(el);}
function saveCurrentAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages.push({role,text});if(role==='me'&&c.title==='New private chat')c.title=text.slice(0,44)+(text.length>44?'…':'');c.model=selectedModel();saveAgentChats();renderAgentHistory();}
function appendAgent(role,text,save=true){const el=document.createElement('div');el.className='agent-msg '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight;if(save)saveCurrentAgentMessage(role,text);return el;}

function appendAgentImage(img){const host=$('agentMessages');if(!host)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const image=img instanceof HTMLImageElement?img:document.createElement('img');if(!(img instanceof HTMLImageElement)){if(typeof img==='string')image.src=img;else if(img?.src)image.src=img.src;else return;}image.alt='Nano Banana 2 generated visual';image.className='agent-generated-image';wrap.appendChild(image);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
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
    if(!puter.auth.isSignedIn())await puter.auth.signIn({request_auth:true});
    const modelInfo=selectedAgentModel();
    if(modelInfo.kind==='image'){
      const visualPrompt=`Create one clear educational 16:9 diagram or flowchart for a student. Use concise keywords, short labels, arrows and simple icons. No long paragraphs. Topic/request: ${text}. Make it suitable for study and for the student to rephrase independently. If the request is code or game development, visualize the logic, system architecture, mechanics, or process instead of reproducing long code.`;
      try{
        const vr=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:visualPrompt,aspectRatio:'16:9',imageSize:'1K'})});
        const vd=await vr.json().catch(()=>({}));
        dots.remove();
        if(vr.ok&&vd.ok&&vd.data){appendAgent('ai','Nano Banana 2 visual generated. Use the keywords and labels shown, then rephrase explanations in your own words.');appendAgentImage(`data:${vd.mimeType||'image/png'};base64,${vd.data}`);}
        else appendAgent('ai',vd.message||'Nano Banana 2 is temporarily unavailable. Please try again.');
      }catch{dots.remove();appendAgent('ai','Nano Banana 2 is temporarily unavailable. Please try again.');}
    }else{
      const system=`You are Nimbus 5.7 Lor • Ultra Modified, a private educational workspace agent.
STYLE: No ** bold markers. Do not use Markdown # headings. Keep responses direct.
STUDENT WORK: For school answers, notes, assignments, essays, or paragraphs, give factual keywords, key points, structure, and concepts rather than polished submission-ready prose. If the user asks you to rewrite or rephrase an answer, say: "Please rephrase it in your own words." Then provide the information/keywords and a suggested structure, not a ready-to-submit paragraph.
VISUALS: When a diagram, flowchart, concept map, or game/system visual is useful, provide concise keywords and a Nano Banana 2-ready visual prompt.
CODING: Always put code in fenced Markdown blocks with a real language identifier. Explain code outside the fence.`;
      const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:selectedModel(),normalize:true,stream:false});
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

async function bootWorkspace(){await loadRepoFiles();await loadAgentModels();renderAgentHistory();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);}
if(window.puter?.auth?.isSignedIn?.()){getPuterUser().then(async u=>{if(!u)return;try{await authorize(u);setSecurity('VERIFIED','ok');openWorkspace();await bootWorkspace();}catch(e){showDenied(e.message);}}).catch(()=>{});}
