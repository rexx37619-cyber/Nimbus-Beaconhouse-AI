const FINANCE_KEY='nimbus_workspace_finance_v4';
const LAYOUT_KEY='nimbus_workspace_layout_v4';
const AGENT_HISTORY_KEY='nimbus_private_agent_chats_v4';
const DEFAULTS={accent:'#6d5dfc',accent2:'#22b8cf',radius:18,sidebar:286,density:'balanced',font:'Plus Jakarta Sans'};
const USD_TO_PKR_DEFAULT=277.27;
const WORKSPACE_USERS={
  'neat_ocean_262513':'Haadi',
  'peaceful_balloon_864250':'Friend'
};
const MODEL_OPTIONS=[
  {alias:'gpt-6-astra',label:'Nimbus 5.7 Lor • Ultra Modified',provider:'openai',kind:'chat'},
  {alias:'claude-fable-5-1',label:'Nimbus Fable 5.1 • Ultra Modified',provider:'claude',kind:'chat'},
  {alias:'nano-banana-2',label:'Nano Banana 2 • Visuals',provider:'gemini',kind:'image'}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={role:'guest',user:null,permissions:[]};
let currentFile={path:'',content:''};
let currentAgentChatId=null;
let agentChats=[];
let puterModels=[];

function safeJson(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
function isOwner(){return session.role==='developer'}
function normalizeUsername(user){return String(user?.username||user?.name||'').trim().toLowerCase()}
function isAllowedUser(user){return Boolean(user&&WORKSPACE_USERS[normalizeUsername(user)])}
function openWorkspace(){ $('gate')?.classList.add('hidden'); $('workspace')?.classList.remove('hidden'); }
function showDenied(msg){const el=$('gateMsg');if(el){el.textContent=msg||'Please sign in with Puter.';el.style.color='#d74764'}}
async function waitForPuter(){const started=Date.now();while(!window.puter&&Date.now()-started<12000)await new Promise(r=>setTimeout(r,120));if(!window.puter)throw new Error('Puter.js did not load. Refresh and try again.')}
async function getUser(){await waitForPuter();if(!puter.auth?.getUser)throw new Error('Puter authentication is unavailable.');return puter.auth.getUser()}

async function ensureSignedIn(){
  await waitForPuter();
  if(puter.auth?.isSignedIn?.()) return getUser();
  if(puter.ui?.authenticateWithPuter){ await puter.ui.authenticateWithPuter(); }
  else if(puter.auth?.signIn){ await puter.auth.signIn(); }
  else throw new Error('Puter sign-in is unavailable.');
  if(!puter.auth?.isSignedIn?.()) throw new Error('Puter sign-in was not completed.');
  return getUser();
}

async function signIn(){
  const button=$('signInBtn'); if(button) button.disabled=true;
  try{
    const user=await ensureSignedIn();
    if(!isAllowedUser(user)) throw new Error('This workspace is limited to the configured Puter accounts.');
    session={role:'developer',user,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};
    const uname=normalizeUsername(user);
    openWorkspace();
    $('rolePill')?.replaceChildren(document.createTextNode('DEVELOPER ACCESS'));
    $('roleNote')?.replaceChildren(document.createTextNode('Puter account authenticated'));
    $('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${WORKSPACE_USERS[uname]||uname}`));
    $('gateMsg')?.replaceChildren(document.createTextNode('Access accepted.'));
    await bootWorkspace();
  }catch(err){showDenied(err?.message||'Puter sign-in failed.');console.error('[Nimbus] sign-in',err)}
  finally{if(button)button.disabled=false}
}

function modelObjectMatches(model,alias){
  const hay=[model?.id,model?.name,...(Array.isArray(model?.aliases)?model.aliases:[])].filter(Boolean).join(' ').toLowerCase();
  if(alias==='gpt-6-astra') return hay.includes('gpt-6-astra');
  if(alias==='claude-fable-5-1') return hay.includes('claude fable 5.1')||hay.includes('claude-fable-5-1');
  return false;
}
async function loadPuterModels(){
  try{
    if(puter.ai?.listModels){
      puterModels=await puter.ai.listModels();
      if(!Array.isArray(puterModels)) puterModels=[];
    }
  }catch(err){puterModels=[];console.warn('[Nimbus] listModels failed',err)}
  populateModelSelect();
}
function resolvePuterModelId(alias){
  const match=puterModels.find(m=>modelObjectMatches(m,alias));
  if(match?.id) return String(match.id);
  if(alias==='gpt-6-astra') return 'gpt-6-astra';
  if(alias==='claude-fable-5-1') return 'anthropic/claude-fable-5-1';
  return alias;
}
function selectedModel(){return $('openaiModelSelect')?.value||'gpt-6-astra'}
function selectedModelMeta(){return MODEL_OPTIONS.find(m=>m.alias===selectedModel())||MODEL_OPTIONS[0]}
function updateModelLabel(){const m=selectedModelMeta();if($('agentModelState'))$('agentModelState').textContent=m.label}
function populateModelSelect(){const select=$('openaiModelSelect');if(!select)return;const old=select.value;select.innerHTML='';for(const m of MODEL_OPTIONS){const o=document.createElement('option');o.value=m.alias;o.textContent=m.label;select.appendChild(o)}select.value=MODEL_OPTIONS.some(m=>m.alias===old)?old:'gpt-6-astra';updateModelLabel()}

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)))}
function loadAgentChats(){agentChats=safeJson(localStorage.getItem(AGENT_HISTORY_KEY)||'[]',[]);if(!Array.isArray(agentChats))agentChats=[]}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:selectedModel(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();currentAgentChatId=id;renderAgentHistory();renderAgentMessages();return id}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';for(const c of agentChats){const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.addEventListener('click',()=>{currentAgentChatId=c.id;renderAgentMessages();renderAgentHistory()});box.appendChild(b)}}
function renderAgentMessages(){const host=$('agentMessages');if(!host)return;host.innerHTML='';const chat=agentChats.find(c=>c.id===currentAgentChatId);if(!chat)return;for(const m of chat.messages||[])appendAgent(m.role,m.text,false);if($('openaiModelSelect')){$('openaiModelSelect').value=MODEL_OPTIONS.some(m=>m.alias===chat.model)?chat.model:'gpt-6-astra';updateModelLabel()}}
function ensureChat(){if(!currentAgentChatId||!agentChats.some(c=>c.id===currentAgentChatId))newAgentChat()}
function saveCurrentMessage(role,text){const chat=agentChats.find(c=>c.id===currentAgentChatId);if(!chat)return;chat.messages=chat.messages||[];chat.messages.push({role,text,ts:Date.now()});if(role==='me'&&(!chat.title||chat.title==='New private chat'))chat.title=String(text).slice(0,42);saveAgentChats();renderAgentHistory()}
function appendAgent(role,text,save=true){const host=$('agentMessages');if(!host)return;const el=document.createElement('div');el.className='agent-message '+(role==='me'?'me':'ai');if(role==='ai')renderRichMessage(el,text);else el.textContent=String(text||'');host.appendChild(el);host.scrollTop=host.scrollHeight;if(save)saveCurrentMessage(role,text);return el}
function appendAgentImage(src){const host=$('agentMessages');if(!host||!src)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const img=document.createElement('img');img.className='agent-generated-image';img.alt='Nano Banana 2 visual';img.src=src;wrap.appendChild(img);host.appendChild(wrap);host.scrollTop=host.scrollHeight}
function renderRichMessage(el,text){
  el.innerHTML='';
  const parts=String(text||'').replace(/\r\n/g,'\n').split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);
  for(let i=0;i<parts.length;i+=3){
    const before=parts[i]||''; if(before){const p=document.createElement('div');p.className='rich-prose';p.textContent=before;el.appendChild(p)}
    const lang=parts[i+1]; const code=parts[i+2]; if(code!==undefined){
      const wrap=document.createElement('div');wrap.className='rich-code-wrap';
      const head=document.createElement('div');head.className='rich-code-head';
      const label=document.createElement('span');label.textContent=(lang||'text').toLowerCase();
      const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';
      const pre=document.createElement('pre');pre.textContent=code.replace(/^\n/,'').replace(/\n$/,'');
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900)}catch{}});
      head.append(label,copy);wrap.append(head,pre);el.appendChild(wrap);
    }
  }
}
function thinkingDots(){const el=document.createElement('div');el.className='agent-thinking';el.innerHTML='<span></span><span></span><span></span>';return el}
function extractText(resp){const c=resp?.message?.content??resp?.content??resp?.text??'';if(typeof c==='string')return c;if(Array.isArray(c))return c.map(p=>typeof p==='string'?p:(p?.text||p?.content||'')).filter(Boolean).join('\n');return ''}

async function runServerFallback(prompt){
  const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt,model:'ror'})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.message||'Fallback unavailable');
  return String(d?.reply||d?.text||'Nimbus could not return a response.');
}
async function runAgentChat(text){
  await ensureSignedIn();
  const meta=selectedModelMeta();
  if(meta.kind==='image'){
    const prompt=`Create a professional, realistic, colorful 16:9 educational visual for: ${text}. Use a strong central subject illustration, accurate visual relationships, clean leader lines, useful icons, short readable labels, depth, lighting, polished textbook/poster composition, and real imagery. Avoid plain text-only layouts, generic three-box diagrams, empty placeholders, or UI wireframes.`;
    const r=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,aspectRatio:'16:9',imageSize:'2K'})});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok&&d.data){appendAgent('ai','Nano Banana 2 visual generated.');appendAgentImage(`data:${d.mimeType||'image/png'};base64,${d.data}`);return}
    if(d?.fallback&&d?.data){appendAgentImage(`data:${d.mimeType||'image/png'};base64,${d.data}`);return}
    throw new Error(d?.message||'Visual generation unavailable');
  }
  const resolvedId=resolvePuterModelId(meta.alias);
  const system='You are Nimbus 5.7 Lor • Ultra Modified, an internal developer workspace agent. Keep answers direct. Never use ** bold markers or Markdown # headings. For schoolwork give keywords, facts, structure and concepts instead of submission-ready prose. If rewriting is requested, say: "Please rephrase it in your own words." Then provide information and structure. For code, always use fenced Markdown with a real language identifier and explain outside the fence.';
  try{
    const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:resolvedId,normalize:true,stream:false});
    const out=extractText(resp); if(out) return out;
    throw new Error('Empty Puter response');
  }catch(err){
    const msg=String(err?.message||err||'');
    if(/balance|allowance|funding|upgrade|insufficient|puter-chat-completion/i.test(msg)) return runServerFallback(text);
    throw err;
  }
}

async function bootAgent(){
  loadAgentChats();
  if(!agentChats.length)newAgentChat();else{currentAgentChatId=agentChats[0].id;renderAgentHistory();renderAgentMessages()}
  await loadPuterModels();
}

function switchTab(tab){document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b.getAttribute('data-tab')===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));if(tab==='files')loadRepoFiles();if(tab==='ui')setTimeout(applyFrameLayout,0);if(tab==='agent')$('agentInput')?.focus()}
function wireTabs(){document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.getAttribute('data-tab'))))}

function loadFinance(){const d=safeJson(localStorage.getItem(FINANCE_KEY)||'{}',{});if($('revenueInput'))$('revenueInput').value=d.revenueUSD??'';if($('expenseInput'))$('expenseInput').value=d.expensesUSD??'';if($('usdPkrRate'))$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance()}
function renderFinance(){const usd=Number($('revenueInput')?.value||0),exp=Number($('expenseInput')?.value||0),rate=Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT),revenue=usd*rate,profit=(usd-exp)*rate;if($('revenueText'))$('revenueText').textContent=`PKR ${Math.round(revenue).toLocaleString()}`;if($('profitText'))$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;if($('marginText'))$('marginText').textContent=`${usd?((profit/Math.max(revenue,1))*100).toFixed(1):0}% margin`;if($('revenueBar'))$('revenueBar').style.width=(revenue?Math.min(100,Math.max(0,profit/revenue*100)):0)+'%'}
function wireFinance(){['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id)?.addEventListener('input',renderFinance));$('saveFinance')?.addEventListener('click',()=>{localStorage.setItem(FINANCE_KEY,JSON.stringify({revenueUSD:Number($('revenueInput')?.value||0),expensesUSD:Number($('expenseInput')?.value||0),rate:Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT)}));renderFinance()});loadFinance()}

async function loadRepoFiles(){if(!isOwner())return;try{const r=await fetch('/api/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not sync important repo files.');$('fileSelect').innerHTML=(d.files||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');$('fileCount').textContent=`${(d.files||[]).length} important repo files`;$('fileMsg').textContent=`Synced from ${d.owner}/${d.repo} @ ${d.branch}`;}catch(e){$('fileMsg').textContent=e.message||'Could not sync repo files.'}}
async function loadFile(path){const safe=String(path||'').replace(/^\/+/, '');if(!safe||safe.includes('..'))throw new Error('Invalid file path.');const r=await fetch('/api/project-file?path='+encodeURIComponent(safe));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not load file.');currentFile={path:d.path,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path}`}
function wireFiles(){ $('loadFile')?.addEventListener('click',async()=>{try{await loadFile($('fileSelect').value)}catch(e){$('fileMsg').textContent=e.message||'Could not load file.'}});$('refreshFiles')?.addEventListener('click',loadRepoFiles);$('saveFile')?.addEventListener('click',()=>{const path=currentFile.path||$('fileSelect').value;if(!path)return;const content=$('fileEditor').value;const blobUrl=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=blobUrl;a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(blobUrl),1000);$('fileMsg').textContent=`Downloaded ${path}. Replace it in Nimbus_CLEAN, then git add, commit and push.`})}

function getLayout(){return{accent:$('accentInput')?.value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput')?.value||18),sidebar:Number($('sidebarInput')?.value||286),density:$('densityInput')?.value||'balanced',font:DEFAULTS.font}}
function readLayout(){const d=safeJson(localStorage.getItem(LAYOUT_KEY)||'{}',{});if($('accentInput'))$('accentInput').value=d.accent||DEFAULTS.accent;if($('radiusInput'))$('radiusInput').value=d.radius||DEFAULTS.radius;if($('sidebarInput'))$('sidebarInput').value=d.sidebar||DEFAULTS.sidebar;if($('densityInput'))$('densityInput').value=d.density||DEFAULTS.density}
function applyFrameLayout(){const frame=$('sitePreview');if(!frame)return;try{const doc=frame.contentDocument;if(!doc)return;const d=getLayout();doc.documentElement.style.setProperty('--nimbus-accent',d.accent);doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');doc.body.dataset.nimbusDensity=d.density;doc.body.style.fontFamily=`"${d.font}",Inter,system-ui,sans-serif`;}catch(e){console.warn('[Nimbus] preview',e)}}
function wireUiStudio(){const frame=$('sitePreview');frame?.addEventListener('load',applyFrameLayout);$('applyLayout')?.addEventListener('click',()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));applyFrameLayout();$('layoutMsg').textContent='Preview updated.'});$('publishLayout')?.addEventListener('click',()=>{const data=JSON.stringify(getLayout(),null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='site-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN and push main.'});$('resetLayout')?.addEventListener('click',()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();$('layoutMsg').textContent='Preview reset.'});readLayout()}

async function bootWorkspace(){wireTabs();wireFinance();wireFiles();wireUiStudio();$('openaiModelSelect')?.addEventListener('change',()=>{const chat=agentChats.find(c=>c.id===currentAgentChatId);if(chat){chat.model=selectedModel();saveAgentChats()}updateModelLabel()});$('newAgentChat')?.addEventListener('click',()=>newAgentChat());$('clearAgentChats')?.addEventListener('click',()=>{agentChats=[];currentAgentChatId=null;saveAgentChats();newAgentChat();renderAgentMessages()});$('agentForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('agentInput');const text=input?.value.trim();if(!text)return;ensureChat();appendAgent('me',text);input.value='';$('agentRunBtn').disabled=true;const dots=thinkingDots();$('agentMessages')?.appendChild(dots);try{const output=await runAgentChat(text);dots.remove();appendAgent('ai',output)}catch(err){dots.remove();appendAgent('ai','Nimbus is temporarily unavailable. Please try again in a moment.');console.error('[Nimbus Workspace Agent]',err)}finally{$('agentRunBtn').disabled=false}});await bootAgent();await loadRepoFiles()}

function bootAuth(){const btn=$('signInBtn');if(btn){btn.addEventListener('click',signIn)}waitForPuter().then(()=>{if(puter.auth?.isSignedIn?.())getUser().then(u=>{if(isAllowedUser(u)){session={role:'developer',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};const uname=normalizeUsername(u);$('rolePill')?.replaceChildren(document.createTextNode('DEVELOPER ACCESS'));$('roleNote')?.replaceChildren(document.createTextNode('Puter account authenticated'));$('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${WORKSPACE_USERS[uname]||uname}`));openWorkspace();bootWorkspace()}}).catch(()=>{})}).catch(()=>{})}

document.addEventListener('DOMContentLoaded',bootAuth);
