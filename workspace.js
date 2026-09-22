const FINANCE_KEY='nimbus_workspace_finance_v3';
const LAYOUT_KEY='nimbus_workspace_layout_v3';
const AGENT_HISTORY_KEY='nimbus_private_agent_chats_v4';
const DEFAULTS={accent:'#6d5dfc',accent2:'#22b8cf',radius:18,sidebar:286,density:'balanced',font:'Plus Jakarta Sans'};
const USD_TO_PKR_DEFAULT=277.27;
const GITHUB_OWNER='rexx37619-cyber';
const GITHUB_REPO='Nimbus-Beaconhouse-AI';
const GITHUB_BRANCH='main';
const WORKSPACE_USERS={
  'neat_ocean_262513':'Haadi',
  'peaceful_balloon_864250':'Friend'
};
const DISPLAY_MODELS=[
  {key:'astra',label:'Nimbus 5.7 Lor • Ultra Modified',provider:'openai',kind:'chat',patterns:['gpt-6-astra']},
  {key:'fable',label:'Nimbus Fable 5.1 • Ultra Modified',provider:'claude',kind:'chat',patterns:['claude-fable-5-1','fable-5-1']},
  {key:'nano',label:'Nano Banana 2 • Visuals',provider:'gemini',kind:'image',patterns:['gemini-3.1-flash-image']}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={role:'developer',user:null,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};
let currentFile={path:'',content:''};
let resolvedModels={};
let currentAgentChatId=null;
let agentChats=[];
try{agentChats=JSON.parse(localStorage.getItem(AGENT_HISTORY_KEY)||'[]');if(!Array.isArray(agentChats))agentChats=[];}catch{agentChats=[];}

function normalizePuterUsername(user){return String(user?.username||user?.name||'').trim().toLowerCase();}
function isAllowedWorkspaceUser(user){return Boolean(user&&WORKSPACE_USERS[normalizePuterUsername(user)]);}
function openWorkspace(){ $('gate')?.classList.add('hidden'); $('workspace')?.classList.remove('hidden'); }
function showDenied(msg){const el=$('gateMsg');if(el){el.textContent=msg||'Sign-in was not completed.';el.style.color='#d74764';}}
function showAllowed(user){const name=normalizePuterUsername(user);openWorkspace();$('rolePill')?.replaceChildren(document.createTextNode('ACCESS ALLOWED'));$('roleNote')?.replaceChildren(document.createTextNode('Puter account authenticated'));$('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${WORKSPACE_USERS[name]||name}`));}
async function waitForPuter(){const start=Date.now();while(!window.puter&&Date.now()-start<15000)await new Promise(r=>setTimeout(r,100));if(!window.puter)throw new Error('Puter.js did not load.');}
async function ensurePuterSignedIn(){
  await waitForPuter();
  if(puter.auth?.isSignedIn?.()) return await puter.auth.getUser();
  if(typeof puter.auth?.signIn!=='function') throw new Error('Puter sign-in is unavailable.');
  await puter.auth.signIn();
  for(let i=0;i<30;i++){
    if(puter.auth?.isSignedIn?.()) break;
    await new Promise(r=>setTimeout(r,250));
  }
  if(!puter.auth?.isSignedIn?.()) throw new Error('Puter sign-in was not completed.');
  return await puter.auth.getUser();
}
async function signIn(){
  const btn=$('signInBtn'); if(btn){btn.disabled=true;btn.textContent='Opening Puter…';}
  try{const user=await ensurePuterSignedIn(); if(!isAllowedWorkspaceUser(user)){showDenied('This Puter account is not one of the two workspace accounts.');return;} session.user=user; showAllowed(user); await initWorkspace(); $('gateMsg')?.replaceChildren(document.createTextNode('Access accepted.'));}
  catch(e){console.error('[Nimbus] Puter sign-in error',e); showDenied(e?.message||'Puter sign-in failed.');}
  finally{if(btn){btn.disabled=false;btn.textContent='Sign in with Puter';}}
}

function saveAgentChats(){localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)));}
function selectedKey(){return $('openaiModelSelect')?.value||'astra';}
function selectedDisplayModel(){return DISPLAY_MODELS.find(m=>m.key===selectedKey())||DISPLAY_MODELS[0];}
function updateModelBadge(){const m=selectedDisplayModel();if($('agentModelState'))$('agentModelState').textContent=m.label;}
async function resolveModels(){
  resolvedModels={};
  try{
    if(puter?.ai?.listModels){
      const openai=await puter.ai.listModels('openai');
      const claude=await puter.ai.listModels('claude');
      const all=[...(Array.isArray(openai)?openai:[]),...(Array.isArray(claude)?claude:[])];
      for(const d of DISPLAY_MODELS.filter(x=>x.kind==='chat')){
        const match=all.find(m=>d.patterns.some(p=>String(m?.id||'').toLowerCase().includes(p)));
        if(match?.id) resolvedModels[d.key]=match.id;
      }
    }
  }catch(e){console.warn('[Nimbus] model discovery failed',e);}
  // Exact fallbacks used only if Puter does not return model metadata.
  resolvedModels.astra=resolvedModels.astra||'openai/gpt-6-astra';
  resolvedModels.fable=resolvedModels.fable||'anthropic/claude-fable-5-1';
}
function populateModelSelect(){const s=$('openaiModelSelect');if(!s)return;s.innerHTML='';for(const m of DISPLAY_MODELS){const o=document.createElement('option');o.value=m.key;o.textContent=m.label;s.appendChild(o);}const c=agentChats.find(x=>x.id===currentAgentChatId);if(c?.model&&DISPLAY_MODELS.some(m=>m.key===c.model))s.value=c.model;updateModelBadge();}
function setupTabs(){document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>{btn.addEventListener('click',()=>{const tab=btn.dataset.tab;document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));if(tab==='files')loadRepoFiles();if(tab==='ui')applyFrameLayout();if(tab==='agent')$('agentInput')?.focus();});});}
function newAgentChat(){const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now()));agentChats.unshift({id,title:'New private chat',model:selectedKey(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();renderAgentHistory();startAgentChat(id);return id;}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';for(const c of agentChats){const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.addEventListener('click',()=>startAgentChat(c.id));box.appendChild(b);}}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c){newAgentChat();return;}currentAgentChatId=c.id;const box=$('agentMessages');if(!box)return;box.innerHTML='';for(const m of c.messages||[])renderSavedAgentMessage(m.role,m.text);if($('openaiModelSelect'))$('openaiModelSelect').value=c.model||'astra';updateModelBadge();renderAgentHistory();}
function saveCurrentAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages=c.messages||[];c.messages.push({role,text,ts:Date.now()});if(role==='me'&&(!c.title||c.title==='New private chat'))c.title=String(text).slice(0,42);saveAgentChats();renderAgentHistory();}
function appendAgent(role,text,save=true){const el=document.createElement('div');el.className='agent-message '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages')?.appendChild(el);if($('agentMessages'))$('agentMessages').scrollTop=$('agentMessages').scrollHeight;if(save)saveCurrentAgentMessage(role,text);return el;}
function renderSavedAgentMessage(role,text){appendAgent(role,text,false);}
function appendAgentImage(src){if(!src)return;const host=$('agentMessages');if(!host)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const img=document.createElement('img');img.src=src;img.alt='Generated study visual';img.className='agent-generated-image';wrap.appendChild(img);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
function extractText(resp){const content=resp?.message?.content??resp?.content??resp?.text??'';if(typeof content==='string')return content;if(Array.isArray(content))return content.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).filter(Boolean).join('\n');return '';}
function renderAgentRichMessage(el,text){el.innerHTML='';const src=String(text||'').replace(/\r\n/g,'\n');const parts=src.split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);for(let i=0;i<parts.length;i+=3){if(parts[i]){const p=document.createElement('div');p.className='rich-prose';p.textContent=parts[i];el.appendChild(p);}if(parts[i+2]!==undefined){const wrap=document.createElement('div');wrap.className='rich-code-wrap';const head=document.createElement('div');head.className='rich-code-head';const label=document.createElement('span');label.textContent=(parts[i+1]||'text').toLowerCase();const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';const pre=document.createElement('pre');pre.textContent=parts[i+2].replace(/^\n/,'').replace(/\n$/,'');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900);}catch{}});head.append(label,copy);wrap.append(head,pre);el.appendChild(wrap);}}}
function thinkingDots(){const d=document.createElement('div');d.className='agent-thinking';d.innerHTML='<span></span><span></span><span></span>';return d;}
async function runAgent(){const input=$('agentInput');const run=$('agentRunBtn');const text=input?.value.trim()||'';if(!text)return;if(!currentAgentChatId)newAgentChat();appendAgent('me',text);input.value='';if(run)run.disabled=true;const dots=thinkingDots();$('agentMessages')?.appendChild(dots);
 try{
   const user=await ensurePuterSignedIn();if(!isAllowedWorkspaceUser(user))throw new Error('This Puter account is not allowed in this workspace.');
   const choice=selectedDisplayModel();
   if(choice.kind==='image'){
     const prompt=`Create a professional 16:9 educational infographic/diagram for this request. Use realistic subject imagery, rich coordinated colors, depth, lighting, polished composition, meaningful icons, clear flow arrows and short readable labels. Avoid plain text-only visuals and generic white boxes. Topic: ${text}`;
     const r=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,aspectRatio:'16:9',imageSize:'2K'})});
     const d=await r.json().catch(()=>({}));dots.remove();
     if(r.ok&&d.ok&&d.data){appendAgent('ai',d.fallback?'Visual generated. Use the labels as study help and rephrase explanations in your own words.':'Nano Banana 2 visual generated. Use the labels as study help and rephrase explanations in your own words.');appendAgentImage(`data:${d.mimeType||'image/png'};base64,${d.data}`);}else appendAgent('ai',d.message||'The visual provider is unavailable right now.');
   }else{
     await resolveModels();const modelId=resolvedModels[choice.key];
     const system='You are Nimbus 5.7 Lor • Ultra Modified, an internal educational developer workspace agent. Avoid ** bold markers and # headings. For schoolwork provide keywords, facts, structure and concepts rather than ready-to-submit prose; when asked to rewrite, say “Please rephrase it in your own words” and then give keywords/structure. Always put code in fenced Markdown blocks with a real language identifier.';
     const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:modelId,stream:false});dots.remove();appendAgent('ai',extractText(resp)||'No response was returned.');
   }
 }catch(err){dots.remove();console.error('[Nimbus workspace agent]',err);const msg=String(err?.message||'');appendAgent('ai',/balance|allowance|upgrade/i.test(msg)?'Puter rejected the request because this account has no available allowance for this model. This cannot be overridden by the website.':'Nimbus is temporarily unavailable. Please try again in a moment.');}
 finally{if(run)run.disabled=false;}
}
function setupAgent(){const form=$('agentForm');if(form)form.addEventListener('submit',e=>{e.preventDefault();runAgent();});$('newAgentChat')?.addEventListener('click',newAgentChat);$('clearAgentChats')?.addEventListener('click',()=>{agentChats=[];saveAgentChats();currentAgentChatId=null;$('agentMessages').innerHTML='';newAgentChat();});$('openaiModelSelect')?.addEventListener('change',()=>{const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=selectedKey();saveAgentChats();}updateModelBadge();});}
function loadFinance(){let d={};try{d=JSON.parse(localStorage.getItem(FINANCE_KEY)||'{}')}catch{};if($('revenueInput'))$('revenueInput').value=d.revenueUSD??'';if($('expenseInput'))$('expenseInput').value=d.expensesUSD??'';if($('usdPkrRate'))$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance();}
function renderFinance(){const usd=Number($('revenueInput')?.value||0),exp=Number($('expenseInput')?.value||0),rate=Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT),rev=usd*rate,profit=(usd-exp)*rate;if($('revenueText'))$('revenueText').textContent=`PKR ${Math.round(rev).toLocaleString()}`;if($('profitText'))$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;if($('marginText'))$('marginText').textContent=`${usd?((profit/rev)*100).toFixed(1):0}% margin`;if($('revenueBar'))$('revenueBar').style.width=(rev?Math.max(0,Math.min(100,profit/rev*100)):0)+'%';}
function setupFinance(){['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id)?.addEventListener('input',renderFinance));$('saveFinance')?.addEventListener('click',()=>{localStorage.setItem(FINANCE_KEY,JSON.stringify({revenueUSD:Number($('revenueInput').value||0),expensesUSD:Number($('expenseInput').value||0),rate:Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT)}));renderFinance();});loadFinance();}
async function loadRepoFiles(){try{const r=await fetch('/api/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not sync repo files.');if($('fileSelect'))$('fileSelect').innerHTML=(d.files||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');if($('fileCount'))$('fileCount').textContent=`${(d.files||[]).length} important repo files`;if($('fileMsg'))$('fileMsg').textContent=`Synced ${d.owner||GITHUB_OWNER}/${d.repo||GITHUB_REPO} @ ${d.branch||GITHUB_BRANCH}`;}catch(e){if($('fileMsg'))$('fileMsg').textContent=e.message||'Could not sync repo files.';}}
async function loadFile(path){const safe=String(path||'').replace(/^\/+/, '');if(!safe||safe.includes('..'))throw new Error('Invalid file path.');const r=await fetch('/api/project-file?path='+encodeURIComponent(safe));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not load file.');currentFile={path:d.path,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path}`;}
function setupFiles(){ $('loadFile')?.addEventListener('click',async()=>{try{await loadFile($('fileSelect').value)}catch(e){$('fileMsg').textContent=e.message||'Could not load file.'}}); $('refreshFiles')?.addEventListener('click',loadRepoFiles); $('saveFile')?.addEventListener('click',()=>{const path=currentFile.path||$('fileSelect').value,content=$('fileEditor').value,a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('fileMsg').textContent=`Downloaded ${path}. Replace it in Nimbus_CLEAN, then git add, commit and push.`;});}
function readLayout(){let d={};try{d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')}catch{};d={...DEFAULTS,...d};if($('accentInput'))$('accentInput').value=d.accent;if($('radiusInput'))$('radiusInput').value=d.radius;if($('sidebarInput'))$('sidebarInput').value=d.sidebar;if($('densityInput'))$('densityInput').value=d.density;return d;}
function getLayout(){return{accent:$('accentInput')?.value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput')?.value||18),sidebar:Number($('sidebarInput')?.value||286),density:$('densityInput')?.value||'balanced',font:DEFAULTS.font};}
function applyFrameLayout(){const frame=$('sitePreview');if(!frame)return;try{const doc=frame.contentDocument;if(!doc)return;const d=getLayout();doc.documentElement.style.setProperty('--nimbus-accent',d.accent);doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');doc.body.dataset.nimbusDensity=d.density;doc.body.style.fontFamily=`"${d.font}",Inter,system-ui,sans-serif`;}catch{}}
function setupUI(){ $('sitePreview')?.addEventListener('load',applyFrameLayout); $('applyLayout')?.addEventListener('click',()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));applyFrameLayout();$('layoutMsg').textContent='Preview updated.';}); $('publishLayout')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(getLayout(),null,2)],{type:'application/json'}));a.download='site-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN and push main.';}); $('resetLayout')?.addEventListener('click',()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();$('layoutMsg').textContent='Preview reset.';});readLayout();}
async function initWorkspace(){setupTabs();setupAgent();setupFinance();setupFiles();setupUI();populateModelSelect();renderAgentHistory();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);await loadRepoFiles();}
async function autoSession(){try{await waitForPuter();if(!puter.auth?.isSignedIn?.())return;const user=await puter.auth.getUser();if(isAllowedWorkspaceUser(user)){session.user=user;showAllowed(user);await initWorkspace();}}catch(e){console.warn('[Nimbus] auto session check',e);}}
window.addEventListener('DOMContentLoaded',()=>{ $('signInBtn')?.addEventListener('click',signIn); autoSession(); });
