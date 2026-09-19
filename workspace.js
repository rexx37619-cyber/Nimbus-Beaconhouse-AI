const FINANCE_KEY='nimbus_workspace_finance_v5';
const LAYOUT_KEY='nimbus_workspace_layout_v5';
const AGENT_HISTORY_KEY='nimbus_private_agent_chats_v5';
const DEFAULTS={accent:'#6d5dfc',accent2:'#22b8cf',radius:18,sidebar:286,density:'balanced',font:'Plus Jakarta Sans'};
const USD_TO_PKR_DEFAULT=277.27;
const ALLOWED_USERS={
  'neat_ocean_262513':'Haadi',
  'peaceful_balloon_864250':'Friend'
};
const MODEL_DEFS=[
  {alias:'gpt-5-6-sol',id:'openai/gpt-5.6-sol',label:'Nimbus Sol 5.6 • Ultra Modified',provider:'openai',kind:'chat'},
  {alias:'claude-fable-5',id:'anthropic/claude-fable-5',label:'Nimbus Fable 5 • Ultra Modified',provider:'claude',kind:'chat'},
  {alias:'claude-opus-5',id:'anthropic/claude-opus-5',label:'Nimbus Opus 5 • Ultra Modified',provider:'claude',kind:'chat'}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={role:'guest',user:null,permissions:[]};
let agentModels=[...MODEL_DEFS];
let agentChats=[];
let currentAgentChatId=null;
let currentFile={path:'',content:''};
const PUTER_BALANCE_BLOCK_KEY='nimbus_puter_balance_blocked_v1';

function safeJson(v,f){try{return JSON.parse(v)}catch{return f}}
function normalizeUsername(u){return String(u?.username||'').trim().toLowerCase()}
function isAllowedUser(u){return !!ALLOWED_USERS[normalizeUsername(u)]}
function showDenied(msg){const e=$('gateMsg');if(e)e.textContent=msg||'Please sign in with Puter.'}
function openWorkspace(){$('gate')?.classList.add('hidden');$('workspace')?.classList.remove('hidden')}
function waitForPuter(timeout=15000){return new Promise((resolve,reject)=>{const start=Date.now();(function tick(){if(window.puter)return resolve();if(Date.now()-start>=timeout)return reject(new Error('Puter.js did not load.'));setTimeout(tick,100)})()})}
async function getPuterUser(){await waitForPuter();return puter.auth.getUser()}

async function signIn(){
  const b=$('signInBtn'); if(b)b.disabled=true;
  try{
    await waitForPuter();
    if(!puter.auth?.isSignedIn?.()) await puter.auth.signIn();
    const u=await puter.auth.getUser();
    if(!isAllowedUser(u)) throw new Error('This workspace is limited to the configured Puter accounts.');
    session={role:'developer',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};
    const uname=normalizeUsername(u);
    $('rolePill')?.replaceChildren(document.createTextNode('DEVELOPER ACCESS'));
    $('roleNote')?.replaceChildren(document.createTextNode('Puter account authenticated'));
    $('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${ALLOWED_USERS[uname]||uname}`));
    showDenied('Access accepted.');
    openWorkspace();
    await bootWorkspace();
  }catch(err){showDenied(err?.message||'Puter sign-in failed.');console.error('[Nimbus workspace auth]',err)}
  finally{if(b)b.disabled=false}
}

function isOwner(){return session.role==='developer' && !!session.user}

function modelLabel(m){
  if(!m)return 'Model';
  if(m.kind==='image')return m.label;
  return m.label||m.name||m.id||'Model';
}
function modelMatches(m,target){
  const hay=[m?.id,m?.name,...(Array.isArray(m?.aliases)?m.aliases:[])].filter(Boolean).join(' ').toLowerCase();
  return hay===target || hay.includes(target.replace('openai/','').replace('anthropic/','').toLowerCase());
}
async function loadAgentModels(){
  const sel=$('openaiModelSelect'); if(!sel)return;
  for(const def of MODEL_DEFS) delete def.resolvedId;
  try{
    const [openai,claude]=await Promise.all([
      puter.ai?.listModels ? puter.ai.listModels('openai').catch(()=>[]) : [],
      puter.ai?.listModels ? puter.ai.listModels('claude').catch(()=>[]) : []
    ]);
    const live=[...(Array.isArray(openai)?openai:[]),...(Array.isArray(claude)?claude:[])];
    for(const def of MODEL_DEFS){
      const m=live.find(x=>modelMatches(x,def.id));
      def.resolvedId=m?.id ? String(m.id) : def.id;
    }
  }catch(e){
    console.warn('[Nimbus workspace] model list unavailable; using official model IDs',e);
  }
  sel.innerHTML='';
  for(const def of MODEL_DEFS){
    const o=document.createElement('option');
    o.value=def.alias;
    o.textContent=modelLabel(def);
    sel.appendChild(o);
  }
  const c=agentChats.find(x=>x.id===currentAgentChatId);
  sel.value=MODEL_DEFS.some(x=>x.alias===(c?.model||''))?(c.model||'gpt-5-6-sol'):'gpt-5-6-sol';
  updateModelLabel();
}

function selectedDef(){return MODEL_DEFS.find(x=>x.alias===($('openaiModelSelect')?.value||'gpt-5-6-sol'))||MODEL_DEFS[0]}
function updateModelLabel(){$('agentModelState')&&( $('agentModelState').textContent=modelLabel(selectedDef()) )}
function resolvedModelId(def){return def.resolvedId||def.id}

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)))}
function loadAgentChats(){agentChats=safeJson(localStorage.getItem(AGENT_HISTORY_KEY)||'[]',[]);if(!Array.isArray(agentChats))agentChats=[]}
function renderRich(el,text){
  el.innerHTML='';
  const parts=String(text||'').split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);
  for(let i=0;i<parts.length;i+=3){
    if(parts[i]){const p=document.createElement('div');p.className='rich-prose';p.textContent=parts[i];el.appendChild(p)}
    if(parts[i+2]!==undefined){
      const wrap=document.createElement('div');wrap.className='rich-code-wrap';
      const head=document.createElement('div');head.className='rich-code-head';
      const label=document.createElement('span');label.textContent=(parts[i+1]||'text').toLowerCase();
      const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';
      const pre=document.createElement('pre');pre.textContent=parts[i+2].replace(/^\n/,'').replace(/\n$/,'');
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900)}catch{}});
      head.append(label,copy);wrap.append(head,pre);el.appendChild(wrap);
    }
  }
}
function appendAgent(role,text,save=true){const host=$('agentMessages');if(!host)return;const el=document.createElement('div');el.className='agent-msg '+(role==='me'?'me':'ai');if(role==='ai')renderRich(el,text);else el.textContent=String(text||'');host.appendChild(el);host.scrollTop=host.scrollHeight;if(save)saveAgentMessage(role,text);}
function appendAgentImage(src){const host=$('agentMessages');if(!host||!src)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const img=document.createElement('img');img.className='agent-generated-image';img.src=src;img.alt='Nimbus generated visual';wrap.appendChild(img);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
function thinkingDots(){const e=document.createElement('div');e.className='agent-thinking';e.innerHTML='<span></span><span></span><span></span>';return e}
function extractText(resp){const c=resp?.message?.content??resp?.content??resp?.text??'';if(typeof c==='string')return c;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).filter(Boolean).join('\n');return ''}
function saveAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages=c.messages||[];c.messages.push({role,text,ts:Date.now()});if(role==='me'&&(!c.title||c.title==='New private chat'))c.title=text.slice(0,44)+(text.length>44?'…':'');c.model=$('openaiModelSelect')?.value||'gpt-5-6-sol';saveAgentChats();renderAgentHistory()}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';for(const c of agentChats){const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.addEventListener('click',()=>startAgentChat(c.id));box.appendChild(b)}}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c)return;currentAgentChatId=c.id;const host=$('agentMessages');if(host)host.innerHTML='';for(const m of c.messages||[]){const el=document.createElement('div');el.className='agent-msg '+(m.role==='me'?'me':'ai');if(m.role==='ai')renderRich(el,m.text);else el.textContent=m.text;host?.appendChild(el)}if($('openaiModelSelect'))$('openaiModelSelect').value=MODEL_DEFS.some(x=>x.alias===c.model)?c.model:'gpt-5-6-sol';updateModelLabel();renderAgentHistory()}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:$('openaiModelSelect')?.value||'gpt-5-6-sol',messages:[]});agentChats=agentChats.slice(0,30);currentAgentChatId=id;saveAgentChats();renderAgentHistory();startAgentChat(id)}
function ensureChat(){if(!currentAgentChatId)newAgentChat()}

async function serverFallback(prompt){
  const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt,model:'ror'})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d?.message||'Nimbus fallback unavailable');
  return String(d?.reply||d?.text||'Nimbus could not return a response.');
}

async function runAgentChat(prompt){
  const def=selectedDef();
  const system=`You are Nimbus private developer workspace AI. Be direct and useful. Do not use ** bold markers or Markdown # headings in normal prose. For schoolwork, give keywords, facts, structure and concepts rather than ready-to-submit prose. If asked to rewrite, say: \"Please rephrase it in your own words.\" Then provide keywords and structure. When code is requested, always use fenced Markdown with the language identifier and explain outside the fence.`;
  // Once Puter reports an account funding/allowance block, stop calling it for the rest of this browser session.
  // This prevents the native Puter low-balance modal from reappearing on every message while keeping the Gemini fallback working.
  if (sessionStorage.getItem(PUTER_BALANCE_BLOCK_KEY) === '1') return serverFallback(prompt);
  try{
    await waitForPuter();
    if(!puter.auth.isSignedIn()) await puter.auth.signIn();
    const modelId=resolvedModelId(def);
    const response=await puter.ai.chat(prompt,{model:modelId, normalize:true});
    const out=extractText(response);
    if(!out) throw new Error('Empty Puter response');
    return out;
  }catch(err){
    const s=String(err?.message||err||'').toLowerCase();
    console.warn('[Nimbus workspace agent] Puter request failed:',err);
    if(/balance|funding|allowance|upgrade|insufficient|credits|puter-chat-completion|payment|quota|unavailable|model/i.test(s)) {
      sessionStorage.setItem(PUTER_BALANCE_BLOCK_KEY,'1');
      return serverFallback(prompt);
    }
    try{
      const retry=await puter.ai.chat(prompt,{model:resolvedModelId(def), normalize:true});
      const retryText=extractText(retry);
      if(retryText) return retryText;
    }catch(retryErr){
      console.warn('[Nimbus workspace agent] retry failed:',retryErr);
    }
    return serverFallback(prompt);
  }
}

function switchTab(tab){document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));if(tab==='files')loadRepoFiles();if(tab==='ui')setTimeout(applyFrameLayout,50);if(tab==='agent')$('agentInput')?.focus()}
function wireTabs(){document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)))}
function loadFinance(){const d=safeJson(localStorage.getItem(FINANCE_KEY)||'{}',{});if($('revenueInput'))$('revenueInput').value=d.revenueUSD??'';if($('expenseInput'))$('expenseInput').value=d.expensesUSD??'';if($('usdPkrRate'))$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance()}
function renderFinance(){const usd=Number($('revenueInput')?.value||0),exp=Number($('expenseInput')?.value||0),rate=Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT),rev=usd*rate,profit=(usd-exp)*rate;if($('revenueText'))$('revenueText').textContent=`PKR ${Math.round(rev).toLocaleString()}`;if($('profitText'))$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;if($('marginText'))$('marginText').textContent=`${usd?((profit/Math.max(usd,0.0001))*100).toFixed(1):0}% margin`;if($('revenueBar'))$('revenueBar').style.width=(rev?Math.min(100,Math.max(0,profit/rev*100)):0)+'%'}
function wireFinance(){['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id)?.addEventListener('input',renderFinance));$('saveFinance')?.addEventListener('click',()=>{localStorage.setItem(FINANCE_KEY,JSON.stringify({revenueUSD:Number($('revenueInput')?.value||0),expensesUSD:Number($('expenseInput')?.value||0),rate:Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT)}));renderFinance();});loadFinance()}
async function loadRepoFiles(){if(!isOwner())return;try{const r=await fetch('/api/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d?.message||'Could not sync repo files.');$('fileSelect').innerHTML=(d.files||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');$('fileCount').textContent=`${(d.files||[]).length} important repo files`;$('fileMsg').textContent=`Synced from ${esc(d.owner||'repo')}/${esc(d.repo||'')}`;}catch(e){$('fileMsg').textContent=e?.message||'Could not sync repo files.'}}
async function loadFile(path){const p=String(path||'').replace(/^\/+/, '');if(!p||p.includes('..'))throw new Error('Invalid file path.');const r=await fetch('/api/project-file?path='+encodeURIComponent(p));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d?.message||'Could not load file.');currentFile={path:d.path,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path}`}
function wireFiles(){$('loadFile')?.addEventListener('click',()=>loadFile($('fileSelect')?.value).catch(e=>$('fileMsg').textContent=e.message));$('refreshFiles')?.addEventListener('click',loadRepoFiles);$('saveFile')?.addEventListener('click',()=>{const path=currentFile.path||$('fileSelect')?.value;if(!path)return;const blob=URL.createObjectURL(new Blob([$('fileEditor').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=blob;a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);$('fileMsg').textContent=`Downloaded ${path}. Replace it in Nimbus_CLEAN, then git add, commit and push.`})}
function readLayout(){const d=safeJson(localStorage.getItem(LAYOUT_KEY)||'{}',{});if($('accentInput'))$('accentInput').value=d.accent||DEFAULTS.accent;if($('radiusInput'))$('radiusInput').value=d.radius||DEFAULTS.radius;if($('sidebarInput'))$('sidebarInput').value=d.sidebar||DEFAULTS.sidebar;if($('densityInput'))$('densityInput').value=d.density||DEFAULTS.density}
function getLayout(){return{accent:$('accentInput')?.value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput')?.value||DEFAULTS.radius),sidebar:Number($('sidebarInput')?.value||DEFAULTS.sidebar),density:$('densityInput')?.value||DEFAULTS.density,font:DEFAULTS.font}}
function applyFrameLayout(){const frame=$('sitePreview');if(!frame)return;try{const doc=frame.contentDocument;if(!doc)return;const d=getLayout();doc.documentElement.style.setProperty('--nimbus-accent',d.accent);doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');doc.body.dataset.nimbusDensity=d.density}catch(e){console.warn('[Nimbus preview]',e)}}
function wireUiStudio(){$('sitePreview')?.addEventListener('load',applyFrameLayout);$('applyLayout')?.addEventListener('click',()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));applyFrameLayout();$('layoutMsg').textContent='Preview updated.'});$('publishLayout')?.addEventListener('click',()=>{const blob=URL.createObjectURL(new Blob([JSON.stringify(getLayout(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=blob;a.download='site-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);$('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN and push main.'});$('resetLayout')?.addEventListener('click',()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();$('layoutMsg').textContent='Preview reset.'});readLayout()}
function wireAgent(){const sel=$('openaiModelSelect');sel?.addEventListener('change',()=>{const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=sel.value;saveAgentChats()}updateModelLabel()});$('newAgentChat')?.addEventListener('click',newAgentChat);$('clearAgentChats')?.addEventListener('click',()=>{agentChats=[];currentAgentChatId=null;saveAgentChats();newAgentChat()});$('agentForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=$('agentInput');const text=input?.value.trim();if(!text)return;ensureChat();appendAgent('me',text);input.value='';const run=$('agentRunBtn');if(run)run.disabled=true;const dots=thinkingDots();$('agentMessages')?.appendChild(dots);try{const out=await runAgentChat(text);dots.remove();if(out)appendAgent('ai',out)}catch(err){dots.remove();appendAgent('ai','Nimbus is temporarily unavailable. Please try again in a moment.');console.error('[Nimbus agent]',err)}finally{if(run)run.disabled=false}})}
async function bootWorkspace(){
  wireTabs();wireFinance();wireFiles();wireUiStudio();wireAgent();
  loadAgentChats();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);
  try{await loadAgentModels()}catch(e){console.warn('[Nimbus] model init',e)}
  try{await loadRepoFiles()}catch(e){console.warn('[Nimbus] repo init',e)}
}
function bootAuth(){const btn=$('signInBtn');if(btn)btn.addEventListener('click',signIn);if(window.puter?.auth?.isSignedIn?.()){puter.auth.getUser().then(async u=>{if(!isAllowedUser(u))return;session={role:'developer',user:u,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};const uname=normalizeUsername(u);$('rolePill')?.replaceChildren(document.createTextNode('DEVELOPER ACCESS'));$('roleNote')?.replaceChildren(document.createTextNode('Puter account authenticated'));$('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${ALLOWED_USERS[uname]||uname}`));showDenied('Access accepted.');openWorkspace();await bootWorkspace()}).catch(()=>{})}}
document.addEventListener('DOMContentLoaded',bootAuth);
