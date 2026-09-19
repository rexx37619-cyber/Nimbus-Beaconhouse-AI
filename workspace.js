const FINANCE_KEY='nimbus_workspace_finance_v4';
const LAYOUT_KEY='nimbus_workspace_layout_v4';
const AGENT_HISTORY_KEY='nimbus_private_agent_chats_v5';
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
  {key:'nano',label:'Nano Banana 2 • Visuals',provider:'gemini',kind:'image',patterns:['gemini-3.1-flash-image','gemini-3.1-flash-image-preview']}
];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={role:'developer',user:null,permissions:['premium_agent','previous_chats','revenue','profit','file_editor','ui_editor','visuals']};
let currentFile={path:'',content:''};
let resolvedModels={};
let currentAgentChatId=null;
let agentChats=[];
try{const saved=JSON.parse(localStorage.getItem(AGENT_HISTORY_KEY)||'[]');agentChats=Array.isArray(saved)?saved:[]}catch{agentChats=[];}

function normalizePuterUsername(user){return String(user?.username||'').trim().toLowerCase();}
function isAllowedWorkspaceUser(user){return Boolean(WORKSPACE_USERS[normalizePuterUsername(user)]);}
function openWorkspace(){$('gate')?.classList.add('hidden');$('workspace')?.classList.remove('hidden');}
function showDenied(msg){const el=$('gateMsg');if(el){el.textContent=msg||'Please sign in with Puter.';el.style.color='#d74764';}}
function showAllowed(user){const name=normalizePuterUsername(user);openWorkspace();$('rolePill')?.replaceChildren(document.createTextNode('ACCESS ALLOWED'));$('roleNote')?.replaceChildren(document.createTextNode('Puter authenticated'));$('userEmail')?.replaceChildren(document.createTextNode(`Puter: ${WORKSPACE_USERS[name]||name}`));$('gateMsg')?.replaceChildren(document.createTextNode('Access accepted.'));}
async function waitForPuter(){const start=Date.now();while(!window.puter&&Date.now()-start<15000)await new Promise(r=>setTimeout(r,100));if(!window.puter)throw new Error('Puter.js did not load.');}
async function ensurePuterSignedIn(forceChooser=false){
  await waitForPuter();
  if(puter.auth?.isSignedIn?.()&&!forceChooser) return await puter.auth.getUser();
  if(typeof puter.auth?.signIn!=='function') throw new Error('Puter sign-in is unavailable.');
  const result=await puter.auth.signIn({request_auth:true});
  const user=result?.user||result?.data?.user||await puter.auth.getUser();
  if(!user)throw new Error('Puter did not return a signed-in account.');
  return user;
}
async function signIn(){
  const btn=$('signInBtn');if(btn){btn.disabled=true;btn.textContent='Opening Puter…';}
  try{
    const user=await ensurePuterSignedIn(true);
    if(!isAllowedWorkspaceUser(user)){showDenied(`This Puter account is not one of the two workspace accounts.`);return;}
    session.user=user;showAllowed(user);await initWorkspace();
  }catch(e){console.error('[Nimbus Workspace] sign-in',e);showDenied(e?.msg||e?.message||'Puter sign-in failed.');}
  finally{if(btn){btn.disabled=false;btn.textContent='Sign in with Puter';}}
}
window.nimbusWorkspaceSignIn=signIn;

function saveAgentChats(){try{localStorage.setItem(AGENT_HISTORY_KEY,JSON.stringify(agentChats.slice(0,30)));}catch{}}
function selectedKey(){return $('openaiModelSelect')?.value||'astra';}
function selectedDisplayModel(){return DISPLAY_MODELS.find(m=>m.key===selectedKey())||DISPLAY_MODELS[0];}
function updateModelBadge(){const m=selectedDisplayModel();if($('agentModelState'))$('agentModelState').textContent=m.label;}
function modelFieldStrings(m){return [m?.id,m?.name,...(Array.isArray(m?.aliases)?m.aliases:[])].filter(Boolean).map(v=>String(v).toLowerCase());}
async function resolveModels(){
  resolvedModels={};
  try{
    if(puter?.ai?.listModels){
      const models=await puter.ai.listModels();
      if(Array.isArray(models)){
        for(const d of DISPLAY_MODELS.filter(x=>x.kind==='chat')){
          const match=models.find(m=>{
            const fields=modelFieldStrings(m);
            const provider=String(m?.provider||'').toLowerCase();
            return provider===d.provider && d.patterns.some(p=>fields.some(f=>f.includes(p.toLowerCase())));
          });
          if(match?.id)resolvedModels[d.key]=String(match.id);
        }
      }
    }
  }catch(e){console.warn('[Nimbus Workspace] model discovery',e);}
  resolvedModels.astra=resolvedModels.astra||'openai/gpt-6-astra';
  resolvedModels.fable=resolvedModels.fable||'anthropic/claude-fable-5-1';
}
function populateModelSelect(){
  const s=$('openaiModelSelect');if(!s)return;s.innerHTML='';
  for(const m of DISPLAY_MODELS){const o=document.createElement('option');o.value=m.key;o.textContent=m.label;s.appendChild(o);}
  const c=agentChats.find(x=>x.id===currentAgentChatId);if(c?.model&&DISPLAY_MODELS.some(m=>m.key===c.model))s.value=c.model;updateModelBadge();
}
function setupTabs(){
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const tab=btn.dataset.tab;
    document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${tab}`));
    if(tab==='files')loadRepoFiles();
    if(tab==='ui')applyFrameLayout();
    if(tab==='agent')setTimeout(()=>$('agentInput')?.focus(),0);
  }));
}
function newAgentChat(){const id=crypto.randomUUID?crypto.randomUUID():String(Date.now());agentChats.unshift({id,title:'New private chat',model:selectedKey(),messages:[]});agentChats=agentChats.slice(0,30);saveAgentChats();renderAgentHistory();startAgentChat(id);return id;}
function renderAgentHistory(){const box=$('agentHistory');if(!box)return;box.innerHTML='';for(const c of agentChats){const b=document.createElement('button');b.type='button';b.className='agent-history-item'+(c.id===currentAgentChatId?' active':'');b.textContent=c.title||'Private chat';b.addEventListener('click',()=>startAgentChat(c.id));box.appendChild(b);}}
function startAgentChat(id){const c=agentChats.find(x=>x.id===id)||agentChats[0];if(!c){newAgentChat();return;}currentAgentChatId=c.id;const box=$('agentMessages');if(box){box.innerHTML='';(c.messages||[]).forEach(m=>renderSavedAgentMessage(m.role,m.text));}if($('openaiModelSelect'))$('openaiModelSelect').value=c.model||'astra';updateModelBadge();renderAgentHistory();}
function saveCurrentAgentMessage(role,text){const c=agentChats.find(x=>x.id===currentAgentChatId);if(!c)return;c.messages=c.messages||[];c.messages.push({role,text,ts:Date.now()});if(role==='me'&&(!c.title||c.title==='New private chat'))c.title=String(text).slice(0,42);c.model=selectedKey();saveAgentChats();renderAgentHistory();}
function appendAgent(role,text,save=true){const el=document.createElement('div');el.className='agent-message '+(role==='me'?'me':'ai');if(role==='ai')renderAgentRichMessage(el,text);else el.textContent=text;$('agentMessages')?.appendChild(el);if($('agentMessages'))$('agentMessages').scrollTop=$('agentMessages').scrollHeight;if(save)saveCurrentAgentMessage(role,text);return el;}
function renderSavedAgentMessage(role,text){appendAgent(role,text,false);}
function appendAgentImage(src){if(!src)return;const host=$('agentMessages');if(!host)return;const wrap=document.createElement('div');wrap.className='agent-image-wrap';const img=document.createElement('img');img.src=src;img.alt='Generated study visual';img.className='agent-generated-image';wrap.appendChild(img);host.appendChild(wrap);host.scrollTop=host.scrollHeight;}
function extractText(resp){const content=resp?.message?.content??resp?.content??resp?.text??'';if(typeof content==='string')return content;if(Array.isArray(content))return content.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).filter(Boolean).join('\n');return '';}
function renderAgentRichMessage(el,text){el.innerHTML='';const src=String(text||'').replace(/\r\n/g,'\n');const parts=src.split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);for(let i=0;i<parts.length;i+=3){if(parts[i]){const p=document.createElement('div');p.className='rich-prose';p.textContent=parts[i];el.appendChild(p);}if(parts[i+2]!==undefined){const wrap=document.createElement('div');wrap.className='rich-code-wrap';const head=document.createElement('div');head.className='rich-code-head';const label=document.createElement('span');label.textContent=(parts[i+1]||'text').toLowerCase();const copy=document.createElement('button');copy.type='button';copy.textContent='Copy';const pre=document.createElement('pre');pre.textContent=parts[i+2].replace(/^\n/,'').replace(/\n$/,'');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(pre.textContent);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900);}catch{}});head.append(label,copy);wrap.append(head,pre);el.appendChild(wrap);}}}
function thinkingDots(){const d=document.createElement('div');d.className='agent-thinking';d.innerHTML='<span></span><span></span><span></span>';return d;}
async function runAgent(){
  const input=$('agentInput'),run=$('agentRunBtn'),text=input?.value.trim()||'';if(!text)return;
  if(!currentAgentChatId)newAgentChat();appendAgent('me',text);input.value='';if(run)run.disabled=true;
  const dots=thinkingDots();$('agentMessages')?.appendChild(dots);
  try{
    const user=await ensurePuterSignedIn(false);if(!isAllowedWorkspaceUser(user))throw new Error('This Puter account is not authorized for the Nimbus workspace.');
    const choice=selectedDisplayModel();
    if(choice.kind==='image'){
      const prompt=`Create a professional, realistic, visually rich 16:9 educational visual for this request. Use meaningful subject imagery, rich coordinated colors, polished typography, depth, lighting, dimensional objects or illustrations, clear visual hierarchy, labeled components, short readable keywords, arrows only where useful, and a presentation-ready poster/flowchart composition. Do not make a plain text-only chart, generic empty boxes, or a simple arrow chain. Keep the visual scientifically or technically accurate. Request: ${text}`;
      const r=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,aspectRatio:'16:9',imageSize:'2K'})});
      const d=await r.json().catch(()=>({}));dots.remove();
      if(r.ok&&d.ok&&d.data){appendAgent('ai','Nano Banana 2 visual generated. Use the keywords and labels as study help, then rephrase explanations in your own words.');appendAgentImage(`data:${d.mimeType||'image/png'};base64,${d.data}`);}else appendAgent('ai',d.message||'Visual generation is unavailable right now.');
    }else{
      await resolveModels();const modelId=resolvedModels[choice.key];
      const system='You are Nimbus 5.7 Lor • Ultra Modified, an internal educational developer workspace agent. Do not use Markdown ** bold markers or # headings. For schoolwork provide keywords, facts, structure, concepts and steps rather than ready-to-submit prose. When asked to rewrite, say: Please rephrase it in your own words, then provide keywords and structure. Always put code in fenced Markdown blocks with a real language identifier. Keep answers direct and practical.';
      const resp=await puter.ai.chat([{role:'system',content:system},{role:'user',content:text}],{model:modelId,normalize:true,stream:false});
      dots.remove();appendAgent('ai',extractText(resp)||'No response was returned.');
    }
  }catch(err){dots.remove();console.error('[Nimbus Workspace Agent]',err);appendAgent('ai',/balance|allowance|upgrade|credits/i.test(String(err?.message||''))?'Puter rejected this request because the signed-in account has no available allowance for that model. The website cannot override Puter account limits.':'Nimbus is temporarily unavailable. Please try again in a moment.');}
  finally{if(run)run.disabled=false;}
}
function setupAgent(){
  $('agentForm')?.addEventListener('submit',e=>{e.preventDefault();runAgent();});
  $('newAgentChat')?.addEventListener('click',newAgentChat);
  $('clearAgentChats')?.addEventListener('click',()=>{agentChats=[];saveAgentChats();currentAgentChatId=null;const box=$('agentMessages');if(box)box.innerHTML='';newAgentChat();});
  $('openaiModelSelect')?.addEventListener('change',()=>{const c=agentChats.find(x=>x.id===currentAgentChatId);if(c){c.model=selectedKey();saveAgentChats();}updateModelBadge();});
}
function loadFinance(){let d={};try{d=JSON.parse(localStorage.getItem(FINANCE_KEY)||'{}')}catch{};if($('revenueInput'))$('revenueInput').value=d.revenueUSD??'';if($('expenseInput'))$('expenseInput').value=d.expensesUSD??'';if($('usdPkrRate'))$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance();}
function renderFinance(){const usd=Number($('revenueInput')?.value||0),exp=Number($('expenseInput')?.value||0),rate=Number($('usdPkrRate')?.value||USD_TO_PKR_DEFAULT),rev=usd*rate,profit=(usd-exp)*rate;if($('revenueText'))$('revenueText').textContent=`PKR ${Math.round(rev).toLocaleString()}`;if($('profitText'))$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;if($('marginText'))$('marginText').textContent=`${usd?((profit/rev)*100).toFixed(1):0}% margin`;if($('revenueBar'))$('revenueBar').style.width=(rev?Math.max(0,Math.min(100,profit/rev*100)):0)+'%';}
function setupFinance(){['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id)?.addEventListener('input',renderFinance));$('saveFinance')?.addEventListener('click',()=>{localStorage.setItem(FINANCE_KEY,JSON.stringify({revenueUSD:Number($('revenueInput').value||0),expensesUSD:Number($('expenseInput').value||0),rate:Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT)}));renderFinance();});loadFinance();}
async function loadRepoFiles(){try{const r=await fetch('/api/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not sync repo files.');if($('fileSelect'))$('fileSelect').innerHTML=(d.files||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');if($('fileCount'))$('fileCount').textContent=`${(d.files||[]).length} important repo files`;if($('fileMsg'))$('fileMsg').textContent=`Synced ${d.owner||GITHUB_OWNER}/${d.repo||GITHUB_REPO} @ ${d.branch||GITHUB_BRANCH}`;}catch(e){if($('fileMsg'))$('fileMsg').textContent=e.message||'Could not sync repo files.';}}
async function loadFile(path){const safe=String(path||'').replace(/^\/+/, '');if(!safe||safe.includes('..'))throw new Error('Invalid file path.');const r=await fetch('/api/project-file?path='+encodeURIComponent(safe));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not load file.');currentFile={path:d.path,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path}`;}
function setupFiles(){
  $('loadFile')?.addEventListener('click',async()=>{try{await loadFile($('fileSelect')?.value)}catch(e){if($('fileMsg'))$('fileMsg').textContent=e.message||'Could not load file.';}});
  $('refreshFiles')?.addEventListener('click',loadRepoFiles);
  $('saveFile')?.addEventListener('click',()=>{const path=currentFile.path||$('fileSelect')?.value||'edited-file.txt',content=$('fileEditor')?.value||'',a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));a.download=path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);if($('fileMsg'))$('fileMsg').textContent=`Downloaded ${path}. Replace it in Nimbus_CLEAN, then git add, commit and push.`;});
}
function readLayout(){let d={};try{d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}')}catch{};d={...DEFAULTS,...d};if($('accentInput'))$('accentInput').value=d.accent;if($('radiusInput'))$('radiusInput').value=d.radius;if($('sidebarInput'))$('sidebarInput').value=d.sidebar;if($('densityInput'))$('densityInput').value=d.density;return d;}
function getLayout(){return{accent:$('accentInput')?.value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput')?.value||18),sidebar:Number($('sidebarInput')?.value||286),density:$('densityInput')?.value||'balanced',font:DEFAULTS.font};}
function applyFrameLayout(){const frame=$('sitePreview');if(!frame)return;try{const doc=frame.contentDocument;if(!doc)return;const d=getLayout();doc.documentElement.style.setProperty('--nimbus-accent',d.accent);doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');doc.body.dataset.nimbusDensity=d.density;doc.body.style.fontFamily=`"${d.font}",Inter,system-ui,sans-serif`;}catch(e){console.warn('[Nimbus UI preview]',e);}}
function setupUI(){
  $('sitePreview')?.addEventListener('load',applyFrameLayout);
  $('applyLayout')?.addEventListener('click',()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));applyFrameLayout();if($('layoutMsg'))$('layoutMsg').textContent='Preview updated.';});
  $('publishLayout')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(getLayout(),null,2)],{type:'application/json'}));a.download='site-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);if($('layoutMsg'))$('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN and push main.';});
  $('resetLayout')?.addEventListener('click',()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();if($('layoutMsg'))$('layoutMsg').textContent='Preview reset.';});readLayout();
}
async function initWorkspace(){
  try{setupTabs();}catch(e){console.error(e)}
  try{setupAgent();}catch(e){console.error(e)}
  try{setupFinance();}catch(e){console.error(e)}
  try{setupFiles();}catch(e){console.error(e)}
  try{setupUI();}catch(e){console.error(e)}
  try{populateModelSelect();}catch(e){console.error(e)}
  try{renderAgentHistory();if(!agentChats.length)newAgentChat();else startAgentChat(agentChats[0].id);}catch(e){console.error(e)}
  try{await loadRepoFiles();}catch(e){console.warn(e)}
}
async function autoSession(){try{await waitForPuter();if(!puter.auth?.isSignedIn?.())return;const user=await puter.auth.getUser();if(isAllowedWorkspaceUser(user)){session.user=user;showAllowed(user);await initWorkspace();}}catch(e){console.warn('[Nimbus] auto session check',e);}}
window.addEventListener('DOMContentLoaded',()=>{
  const btn=$('signInBtn');if(btn)btn.addEventListener('click',signIn);
  autoSession();
});
