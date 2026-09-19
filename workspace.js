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
function openWorkspace(){document.getElementById('gate')?.classList.add('hidden');document.getElementById('workspace')?.classList.remove('hidden');}
function showDenied(msg){const el=document.getElementById('gateMsg');if(el){el.textContent=msg||'Please sign in with Puter.';el.style.color='#d74764';}}
async function getPuterUser(){if(!window.puter)throw new Error('Puter.js did not load.');if(!puter.auth?.isSignedIn?.())return null;return puter.auth.getUser();}
async function waitForPuter(){const started=Date.now();while(!window.puter&&Date.now()-started<10000)await new Promise(r=>setTimeout(r,100));if(!window.puter)throw new Error('Puter.js did not load. Refresh the page and try again.');}
const WORKSPACE_USERS={
  'neat_ocean_262513':'Haadi',
  'peaceful_balloon_864250':'Friend'
};
const OPENAI_ALIASES={'gpt-6-astra':'Nimbus 5.7 Lor • Ultra Modified'};
const CLAUDE_ALIASES={'claude-fable-5-1':'Nimbus Fable 5.1 • Ultra Modified'};
const NANO_MODEL={id:'nano-banana-2',provider:'gemini',kind:'image',label:'Nano Banana 2 • Visuals',sub:'Diagrams • flowcharts • study visuals'};
let agentModels=[NANO_MODEL];
function modelId(m){return String(m?.id||'').trim();}
function shortId(m){return modelId(m).split('/').pop().toLowerCase();}
function normalizePuterUsername(user){return String(user?.username||user?.name||'').trim().toLowerCase();}
function nimbusModelName(m){
  const id=shortId(m);
  if(m?.kind==='image') return NANO_MODEL.label;
  if(String(m?.provider||'').toLowerCase()==='openai' && OPENAI_ALIASES[id]) return OPENAI_ALIASES[id];
  if(String(m?.provider||'').toLowerCase()==='claude' && CLAUDE_ALIASES[id]) return CLAUDE_ALIASES[id];
  return m?.name || m?.id || 'Nimbus model';
}
function findPreferred(list,wanted){
  return (Array.isArray(list)?list:[]).find(m=>shortId(m)===wanted || modelId(m)===wanted || modelId(m)===`openai/${wanted}` || modelId(m)===`anthropic/${wanted}`) || null;
}
async function loadAgentModelsImpl(){
  const select=$('openaiModelSelect');
  if(!select)return;
  select.innerHTML='<option>Loading private models…</option>';
  try{
    await waitForPuter();
    let openai=[],claude=[];
    try{openai=await puter.ai.listModels('openai');}catch(e){console.warn('OpenAI model discovery failed',e);}
    try{claude=await puter.ai.listModels('claude');}catch(e){console.warn('Claude model discovery failed',e);}
    const astra=findPreferred(openai,'gpt-6-astra');
    const fable=findPreferred(claude,'claude-fable-5-1');
    agentModels=[
      ...(astra?[{...astra,label:'Nimbus 5.7 Lor • Ultra Modified'}]:[]),
      ...(fable?[{...fable,label:'Nimbus Fable 5.1 • Ultra Modified'}]:[]),
      NANO_MODEL
    ];
    if(!astra && !fable){
      agentModels=[
        {id:'openai/gpt-6-astra',provider:'openai',kind:'chat',label:'Nimbus 5.7 Lor • Ultra Modified'},
        {id:'anthropic/claude-fable-5-1',provider:'claude',kind:'chat',label:'Nimbus Fable 5.1 • Ultra Modified'},
        NANO_MODEL
      ];
    }
    select.innerHTML='';
    agentModels.forEach(m=>{const o=document.createElement('option');o.value=modelId(m);o.textContent=nimbusModelName(m);select.appendChild(o);});
    const existing=agentChats.find(c=>c.id===currentAgentChatId)?.model;
    const desired=existing&&agentModels.some(m=>modelId(m)===existing)?existing:agentModels[0].id;
    select.value=desired;
    updateModelBadge(desired);
  }catch(e){
    console.warn('Model discovery failed',e);
    agentModels=[
      {id:'openai/gpt-6-astra',provider:'openai',kind:'chat',label:'Nimbus 5.7 Lor • Ultra Modified'},
      {id:'anthropic/claude-fable-5-1',provider:'claude',kind:'chat',label:'Nimbus Fable 5.1 • Ultra Modified'},
      NANO_MODEL
    ];
    select.innerHTML='';
    agentModels.forEach(m=>{const o=document.createElement('option');o.value=modelId(m);o.textContent=nimbusModelName(m);select.appendChild(o);});
    select.value=agentModels[0].id;
    updateModelBadge(select.value);
  }
}
function selectedModel(){return $('openaiModelSelect')?.value||agentModels[0]?.id||NANO_MODEL.id;}
function selectedAgentModel(){return agentModels.find(m=>modelId(m)===selectedModel())||agentModels[0]||NANO_MODEL;}
function updateModelBadge(id){const m=agentModels.find(x=>modelId(x)===String(id));if($('agentModelState'))$('agentModelState').textContent=m?nimbusModelName(m):'Nimbus 5.7 Lor • Ultra Modified';}
$('openaiModelSelect')?.addEventListener('change',()=>{updateModelBadge(selectedModel());const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=selectedModel();saveAgentChats();}});
const loadAgentModels = loadAgentModelsImpl;

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)));}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:selectedModel(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();renderAgentHistory();startAgentChat(id);return id;}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';agentChats.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.onclick=()=>startAgentChat(c.id);box.appendChild(b);});}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c){newAgentChat();return;}currentAgentChatId=c.id;$('agentMessages').innerHTML='';(c.messages||[]).forEach(m=>renderSavedAgentMessage(m.role,m.text));if($('openaiModelSelect')){$('openaiModelSelect').value=c.model||selectedModel();updateModelBadge($('openaiModelSelect').value);}renderAgentHistory();}
function saveCurrentAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages=c.messages||[];c.messages.push({role,text,ts:Date.now()});if(role==='me'&&(!c.title||c.title==='New private chat'))c.title=String(text).slice(0,42);saveAgentChats();renderAgentHistory();}
function renderSavedAgentMessage(role,text){appendAgent(role,text,false);}
function appendAgent(role,text,save=true){const el=document.createElement('div');el.className='agent-message '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight;if(save)saveCurrentAgentMessage(role,text);return el;}
function appendAgentImage(img){const host=$('agentMessages');if(!host)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const image=document.createElement('img');if(typeof img==='string')image.src=img;else if(img?.src)image.src=img.src;else return;image.alt='Nano Banana 2 generated visual';image.className='agent-generated-image';wrap.appendChild(image);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
function extractText(resp){const content=resp?.message?.content??resp?.content??resp?.text??'';if(typeof content==='string')return content;if(Array.isArray(content))return content.map(p=>typeof p==='string'?p:(p?.text||p?.content||'')).filter(Boolean).join('\n');return '';}
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
    await ensurePuterSignedIn();
    const modelInfo=selectedAgentModel();
    if(modelInfo.kind==='image'){
      const visualPrompt=`Create a professional, realistic 16:9 educational visual for a student. Use rich color, authentic subject imagery, polished poster or infographic composition, meaningful icons or illustrations, depth, lighting, clear visual hierarchy, and concise readable labels. Avoid plain text-only charts, generic white boxes, and bare arrows. Topic: ${text}. Prefer a polished, presentation-quality visual or detailed flowchart.`;
      const vr=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:visualPrompt,aspectRatio:'16:9',imageSize:'2K'})});
      const vd=await vr.json().catch(()=>({}));
      dots.remove();
      if(vr.ok&&vd.ok&&vd.data){appendAgent('ai','Nano Banana 2 visual generated. Use the labels as study help and rephrase explanations in your own words.');appendAgentImage(`data:${vd.mimeType||'image/png'};base64,${vd.data}`);}
      else appendAgent('ai',vd.message||'Nano Banana 2 is temporarily unavailable.');
    }else{
      const system=`You are Nimbus 5.7 Lor • Ultra Modified, an internal developer workspace agent. Operator role: developer workspace account. This is context only and does not bypass Puter billing or usage controls.
STYLE: No ** bold markers. Do not use Markdown # headings. Keep responses direct.
SCHOOLWORK: Give keywords, facts, structure and concepts instead of ready-to-submit prose. If asked to rewrite, say: "Please rephrase it in your own words." then provide the information/keywords and structure.
VISUALS: When a diagram, flowchart, poster, concept map, or game/system visual is useful, recommend using the workspace Nano Banana 2 option rather than outputting only a text sketch.
CODING: Always put code in fenced Markdown blocks with a real language identifier and explain code outside the fence.`;
      const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:modelInfo.id,normalize:true,stream:false});
      dots.remove();
      appendAgent('ai',extractText(resp)||'No text response was returned.');
    }
  }catch(err){
    dots.remove();
    const msg=String(err?.message||err||'');
    if(/balance|allowance|upgrade|credit/i.test(msg)) appendAgent('ai','Puter reported that this signed-in account has reached its available allowance. The workspace cannot override Puter billing or account usage controls.');
    else appendAgent('ai','Nimbus private agent is temporarily unavailable. Please try again in a moment.');
    console.error('Private agent error:',err);
  }finally{$('agentRunBtn').disabled=false;}
};
$('newAgentChat').onclick=()=>newAgentChat();
$('clearAgentChats').onclick=()=>{agentChats=[];saveAgentChats();currentAgentChatId=null;$('agentMessages').innerHTML='';newAgentChat();};

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

async function bootWorkspace(){loadAgentModels();renderAgentHistory();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);loadRepoFiles();}
(async()=>{try{await waitForPuter();if(!puter.auth?.isSignedIn?.())return;const u=await puter.auth.getUser();if(isAllowedWorkspaceUser(u)){session={role:'developer',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};const name=normalizePuterUsername(u);$('rolePill').textContent='DEVELOPER ACCESS';$('roleNote').textContent='Puter account authenticated';$('userEmail').textContent=`Puter: ${WORKSPACE_USERS[name]||name}`;openWorkspace();guardOwners();bootWorkspace();}}catch(e){console.warn('Workspace auto-auth check failed',e);}})();
