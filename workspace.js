const OWNER_LOCAL_KEY='nimbus_workspace_finance_v2';
const LAYOUT_KEY='nimbus_workspace_layout_v2';
const DEFAULTS={accent:'#6d5dfc',accent2:'#22b8cf',radius:18,sidebar:260,density:'balanced',font:'Plus Jakarta Sans'};
const PREMIUM_LABEL='Nimbus 5.7 Lor • Ultra Modified';
const PREMIUM_MODEL_ID='gpt-6-astra';
const FALLBACK_MODEL_ID='gpt-5.6-luna';
const USD_TO_PKR_DEFAULT=277.27;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={user:null,role:'denied',permissions:[]};
let repoCache=[];
let currentFile={path:'',sha:'',content:''};
let openAIModels=[];
const GITHUB_OWNER='rexx37619-cyber';
const GITHUB_REPO='Nimbus-Beaconhouse-AI';
const GITHUB_BRANCH='main';

function setSecurity(text,kind='wait'){ $('securityBadge').textContent=`SECURITY CHECK: ${text}`; $('securityBadge').style.color=kind==='ok'?'#0f9f72':kind==='bad'?'#d74764':'#b37a00'; }
function isOwner(){return session.role==='owner'}
function guardOwners(){document.querySelectorAll('.owner-only').forEach(el=>el.classList.toggle('hidden',!isOwner()));document.querySelectorAll('.owner-only-panel').forEach(el=>el.classList.toggle('hidden',!isOwner()));}
async function getPuterUser(){if(!window.puter) throw new Error('Puter.js did not load.');if(!puter.auth.isSignedIn()) return null;return await puter.auth.getUser();}
async function getPuterEmail(){if(!window.puter) throw new Error('Puter.js did not load.');if(!puter.auth.isSignedIn()) return null;if(typeof puter.perms?.requestEmail==='function'){const e=await puter.perms.requestEmail();if(e)return String(e).trim().toLowerCase()}if(typeof puter.perms?.request==='function'){const e=await puter.perms.request('email');if(e)return String(e).trim().toLowerCase()}return '';}
async function authorize(user){const email=await getPuterEmail();if(!email)throw new Error('Nimbus needs Email access from Puter to verify your workspace account.');const r=await fetch('/.netlify/functions/workspace-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||'Workspace access denied.');session={user,role:d.role,permissions:d.permissions||[]};$('userEmail').textContent=email;$('rolePill').textContent=d.role.toUpperCase();$('roleNote').textContent=d.role==='owner'?'Full workspace access':'Agent-only worker access';$('overviewRole').textContent=d.role==='owner'?'Owner':'Worker';$('securityRoleTag').textContent=d.role==='owner'?'OWNER':'WORKER';$('serverState').textContent='Allowlisted';$('permissionState').textContent=d.permissions.join(' • ');$('puterState').textContent='Authenticated';guardOwners();}
function openWorkspace(){ $('gate').classList.add('hidden');$('workspace').classList.remove('hidden'); }
function showDenied(msg){$('gateMsg').textContent=msg;$('gateMsg').style.color='#d74764';setSecurity('DENIED','bad')}
async function signIn(){$('signInBtn').disabled=true;$('gateMsg').textContent='Opening Puter sign-in…';setSecurity('AUTHENTICATING');try{await puter.auth.signIn({request_auth:true});const u=await getPuterUser();await authorize(u);$('gateMsg').textContent=`Access granted as ${session.role}.`;setSecurity('VERIFIED','ok');openWorkspace();if(isOwner()){await loadRepoFiles();}}catch(e){showDenied(e.message||'Authentication failed.')}finally{$('signInBtn').disabled=false}}
$('signInBtn').onclick=signIn;
if(window.puter?.auth?.isSignedIn?.()){getPuterUser().then(async u=>{if(!u)return;try{await authorize(u);setSecurity('VERIFIED','ok');openWorkspace();if(isOwner())await loadRepoFiles()}catch(e){showDenied(e.message)}}).catch(()=>{})}

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{if(btn.classList.contains('hidden'))return;document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$('tab-'+btn.dataset.tab).classList.add('active');}));

async function loadOpenAIModels(){
  const select=$('openaiModelSelect');
  if(!select) return;
  select.innerHTML='<option>Loading OpenAI models…</option>';
  try{
    let models=[];
    if(window.puter?.ai?.listModels){
      try{ models=await puter.ai.listModels('openai'); }catch{ models=await puter.ai.listModels(); }
    }
    openAIModels=(models||[]).filter(m=>{
      const provider=String(m?.provider||'').toLowerCase();
      const id=String(m?.id||'').toLowerCase();
      return provider==='openai' || id.startsWith('gpt-') || id.includes('/gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4');
    });
    const seen=new Set();
    openAIModels=openAIModels.filter(m=>{const id=String(m?.id||'');if(!id||seen.has(id))return false;seen.add(id);return true;}).sort((a,b)=>String(a?.name||a?.id).localeCompare(String(b?.name||b?.id)));
    const preferred=['gpt-6-astra','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna'];
    openAIModels.sort((a,b)=>{
      const ai=preferred.indexOf(String(a?.id||'')); const bi=preferred.indexOf(String(b?.id||''));
      return (ai<0?99:ai)-(bi<0?99:bi);
    });
    select.innerHTML='';
    for(const m of openAIModels){
      const id=String(m.id);
      const opt=document.createElement('option');
      opt.value=id;
      opt.textContent=m.name||id;
      select.appendChild(opt);
    }
    if(!openAIModels.length){
      select.innerHTML='<option value="gpt-6-astra">GPT-6 Astra (check Puter availability)</option>';
    }
    select.value=openAIModels.some(m=>m.id==='gpt-6-astra')?'gpt-6-astra':(openAIModels[0]?.id||'gpt-6-astra');
  }catch(e){
    console.warn('OpenAI model discovery failed',e);
    select.innerHTML='<option value="gpt-6-astra">GPT-6 Astra</option>';
  }
}
async function findPremiumModel(){
  const selected=$('openaiModelSelect')?.value;
  if(selected) return selected;
  try{
    if(window.puter?.ai?.listModels){
      const models=await puter.ai.listModels();
      const ids=(models||[]).flatMap(m=>[m?.id,...(Array.isArray(m?.aliases)?m.aliases:[])]).filter(Boolean).map(String);
      const hit=ids.find(id=>id.toLowerCase()==='gpt-6-astra' || id.toLowerCase().endsWith('/gpt-6-astra'));
      if(hit)return hit;
    }
  }catch(e){console.warn('Puter model discovery failed',e)}
  return 'gpt-5.6-luna';
}
function setAgentBusy(busy){document.body.classList.toggle('agent-busy',busy);const b=$('agentRunBtn');if(b){b.disabled=busy;b.textContent=busy?'Working…':'Run'}}
$('agentForm').onsubmit=async e=>{e.preventDefault();const text=$('agentInput').value.trim();if(!text)return;appendAgent('me',text);$('agentInput').value='';appendAgent('ai','Connecting to Nimbus 5.7 Lor…');const last=$('agentMessages').lastElementChild;setAgentBusy(true);try{
  if(!window.puter) throw new Error('Puter.js did not load.');
  if(!puter.auth.isSignedIn()){await puter.auth.signIn({request_auth:true});}
  let model=await findPremiumModel();
  $('agentModelState').textContent=model==='gpt-6-astra'?'GPT-6 Astra':'Puter: '+model;
  let resp;
  try{
    resp=await puter.ai.chat([{role:'system',content:'You are Nimbus 5.7 Lor • Ultra Modified, a private workspace agent. Be concise, practical, and transparent about what you can access.'},{role:'user',content:text}],{model,normalize:true});
  }catch(firstErr){
    if(model!=='gpt-5.6-luna'){
      model='gpt-5.6-luna';
      $('agentModelState').textContent='Puter: gpt-5.6-luna fallback';
      resp=await puter.ai.chat([{role:'system',content:'You are Nimbus 5.7 Lor • Ultra Modified, a private workspace agent. Be concise and practical.'},{role:'user',content:text}],{model,normalize:true});
    }else{throw firstErr}
  }
  last.textContent=extractText(resp)||'No text response was returned.';
}catch(err){last.textContent='Nimbus 5.7 Lor is temporarily unavailable. Please try again in a moment.';console.error(err)}finally{setAgentBusy(false)}};

function extractText(resp){
  const content=resp?.message?.content ?? resp?.content ?? resp?.text ?? '';
  if(typeof content==='string') return content;
  if(Array.isArray(content)){
    return content.map(part=>{
      if(typeof part==='string') return part;
      return part?.text || part?.content || '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

function appendAgent(role,text){const el=document.createElement('div');el.className='agent-msg'+(role==='me'?' me':'');el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight}

function loadFinance(){const d=JSON.parse(localStorage.getItem(OWNER_LOCAL_KEY)||'{}');$('revenueInput').value=d.revenueUSD??'';$('expenseInput').value=d.expensesUSD??'';$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance()}
function renderFinance(){const usd=Number($('revenueInput').value||0), exp=Number($('expenseInput').value||0), rate=Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT), pkr=(usd*rate), cost=(exp*rate), profit=pkr-cost;$('revenueText').textContent=`PKR ${Math.round(pkr).toLocaleString()}`;$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;$('marginText').textContent=`${usd?((profit/pkr)*100).toFixed(1):0}% margin • USD ${usd.toLocaleString()} @ ${rate}`;$('revenueBar').style.width=(pkr?Math.min(100,Math.max(0,profit/pkr*100)):0)+'%';}
['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id).addEventListener('input',renderFinance));
$('saveFinance').onclick=()=>{localStorage.setItem(OWNER_LOCAL_KEY,JSON.stringify({revenueUSD:Number($('revenueInput').value||0),expensesUSD:Number($('expenseInput').value||0),rate:Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT)}));renderFinance()};
loadFinance();

async function loadRepoFiles(){
  if(!isOwner())return;
  try{
    const url=`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${encodeURIComponent(GITHUB_BRANCH)}?recursive=1`;
    const r=await fetch(url,{headers:{Accept:'application/vnd.github+json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d?.message||'Could not read the public Nimbus repository.');
    repoCache=(d.tree||[]).filter(x=>x.type==='blob').map(x=>x.path).filter(p=>!p.startsWith('.git/')).sort();
    $('fileSelect').innerHTML=repoCache.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    $('fileCount').textContent=`${repoCache.length} repository files`;$('fileMsg').textContent='Synced from GitHub main branch.';
  }catch(e){
    $('fileMsg').textContent=e.message||'Could not sync repository files.';
  }
}
async function loadFile(path){
  const safe=String(path||'').replace(/^\/+/, '');
  if(!safe || safe.includes('..')) throw new Error('Invalid file path.');
  const url=`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${encodeURIComponent(GITHUB_BRANCH)}/${safe.split('/').map(encodeURIComponent).join('/')}`;
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok) throw new Error('Could not load that repository file.');
  const content=await r.text();
  currentFile={path:safe,sha:'',content};
  $('fileEditor').value=content;
  $('fileMsg').textContent=`Loaded ${safe} from GitHub main branch.`;
}
$('loadFile').onclick=async()=>{try{await loadFile($('fileSelect').value)}catch(e){$('fileMsg').textContent=e.message||'Could not load file.'}};
$('refreshFiles').onclick=loadRepoFiles;

function readLayout(){
  const d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null')||DEFAULTS;
  $('accentInput').value=d.accent||DEFAULTS.accent;
  $('radiusInput').value=d.radius||DEFAULTS.radius;
  $('sidebarInput').value=d.sidebar||DEFAULTS.sidebar;
  $('densityInput').value=d.density||DEFAULTS.density;
  return d;
}
function getLayout(){
  return{accent:$('accentInput').value||DEFAULTS.accent,accent2:DEFAULTS.accent2,radius:Number($('radiusInput').value||18),sidebar:Number($('sidebarInput').value||260),density:$('densityInput').value||'balanced',font:DEFAULTS.font};
}
function applyFrameLayout(){
  const frame=$('sitePreview'); if(!frame) return;
  const d=getLayout();
  try{
    const doc=frame.contentDocument; if(!doc) return;
    doc.documentElement.style.setProperty('--nimbus-accent',d.accent);
    doc.documentElement.style.setProperty('--nimbus-accent-2',d.accent2);
    doc.documentElement.style.setProperty('--nimbus-radius',d.radius+'px');
    doc.body.style.fontFamily=`"${d.font}",Inter,system-ui,sans-serif`;
    doc.body.dataset.nimbusDensity=d.density;
    const badge=doc.createElement('div'); badge.id='__nimbus_preview_badge'; badge.textContent='UI PREVIEW';
    Object.assign(badge.style,{position:'fixed',right:'12px',top:'12px',zIndex:'2147483647',padding:'6px 9px',borderRadius:'999px',background:d.accent,color:'#fff',font:'700 10px Arial',boxShadow:'0 8px 20px rgba(0,0,0,.18)'});
    doc.getElementById('__nimbus_preview_badge')?.remove(); doc.body.appendChild(badge);
  }catch(e){console.warn('Preview frame update failed',e)}
}
$('sitePreview')?.addEventListener('load',applyFrameLayout);
function saveLayoutLocal(){const d=getLayout();localStorage.setItem(LAYOUT_KEY,JSON.stringify(d));return d}
$('applyLayout').onclick=()=>{const d=saveLayoutLocal();applyFrameLayout();$('layoutMsg').textContent='Preview updated. Use Export UI update to create the deployable site-layout.json file.';};
$('publishLayout').onclick=()=>{
  const d=saveLayoutLocal();
  const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='site-layout.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  $('layoutMsg').textContent='Downloaded site-layout.json. Replace it in Nimbus_CLEAN, then git add, git commit, git push origin main.';
};
$('resetLayout').onclick=()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();applyFrameLayout();$('layoutMsg').textContent='Preview reset.';};
readLayout();
loadOpenAIModels();
