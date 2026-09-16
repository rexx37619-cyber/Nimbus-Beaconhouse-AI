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

async function findPremiumModel(){
  const preferred=['gpt-6-astra','gpt-5.6-luna'];
  try{
    if(!window.puter?.ai?.listModels) return 'gpt-5.6-luna';
    const models=await puter.ai.listModels();
    const ids=(models||[]).flatMap(m=>[m?.id,...(Array.isArray(m?.aliases)?m.aliases:[])]).filter(Boolean).map(String);
    for(const wanted of preferred){const hit=ids.find(id=>id.toLowerCase()===wanted.toLowerCase());if(hit)return hit;}
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
    resp=await puter.ai.chat([{role:'system',content:'You are Nimbus 5.7 Lor • Ultra Modified, a private workspace agent. Be concise, practical, and transparent about what you can access.'},{role:'user',content:text}],{model,normalize:true,reasoning_effort:'low'});
  }catch(firstErr){
    if(model!=='gpt-5.6-luna'){
      model='gpt-5.6-luna';
      $('agentModelState').textContent='Puter: gpt-5.6-luna fallback';
      resp=await puter.ai.chat([{role:'system',content:'You are Nimbus 5.7 Lor • Ultra Modified, a private workspace agent. Be concise and practical.'},{role:'user',content:text}],{model,normalize:true,reasoning_effort:'low'});
    }else{throw firstErr}
  }
  last.textContent=extractText(resp)||'No text response was returned.';
}catch(err){last.textContent='Nimbus 5.7 Lor is temporarily unavailable. Please try again in a moment.';console.error(err)}finally{setAgentBusy(false)}};
function appendAgent(role,text){const el=document.createElement('div');el.className='agent-msg'+(role==='me'?' me':'');el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight}

function loadFinance(){const d=JSON.parse(localStorage.getItem(OWNER_LOCAL_KEY)||'{}');$('revenueInput').value=d.revenueUSD??'';$('expenseInput').value=d.expensesUSD??'';$('usdPkrRate').value=d.rate??USD_TO_PKR_DEFAULT;renderFinance()}
function renderFinance(){const usd=Number($('revenueInput').value||0), exp=Number($('expenseInput').value||0), rate=Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT), pkr=(usd*rate), cost=(exp*rate), profit=pkr-cost;$('revenueText').textContent=`PKR ${Math.round(pkr).toLocaleString()}`;$('profitText').textContent=`PKR ${Math.round(profit).toLocaleString()}`;$('marginText').textContent=`${usd?((profit/pkr)*100).toFixed(1):0}% margin • USD ${usd.toLocaleString()} @ ${rate}`;$('revenueBar').style.width=(pkr?Math.min(100,Math.max(0,profit/pkr*100)):0)+'%';}
['revenueInput','expenseInput','usdPkrRate'].forEach(id=>$(id).addEventListener('input',renderFinance));
$('saveFinance').onclick=()=>{localStorage.setItem(OWNER_LOCAL_KEY,JSON.stringify({revenueUSD:Number($('revenueInput').value||0),expensesUSD:Number($('expenseInput').value||0),rate:Number($('usdPkrRate').value||USD_TO_PKR_DEFAULT)}));renderFinance()};
loadFinance();

async function loadRepoFiles(){if(!isOwner())return;try{const r=await fetch('/.netlify/functions/project-files');const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message);repoCache=d.files.filter(p=>!p.startsWith('.git/')).sort();$('fileSelect').innerHTML=repoCache.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');$('fileCount').textContent=`${repoCache.length} repository files`;$('fileMsg').textContent='Synced from GitHub main branch.';}catch(e){$('fileMsg').textContent=e.message||'Could not sync repository files.';}}
async function loadFile(path){const r=await fetch('/.netlify/functions/project-file?path='+encodeURIComponent(path));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message);currentFile={path:d.path,sha:d.sha,content:d.content};$('fileEditor').value=d.content;$('fileMsg').textContent=`Loaded ${d.path} from main.`}
$('loadFile').onclick=async()=>{try{await loadFile($('fileSelect').value)}catch(e){$('fileMsg').textContent=e.message||'Could not load file.'}}
$('saveFile').onclick=()=>{if(!isOwner())return;const path=$('fileSelect').value;const content=$('fileEditor').value;const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=path.split('/').pop()||'nimbus-file.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('fileMsg').textContent=`Downloaded ${path}. Replace that file in Nimbus_CLEAN, then git add, git commit, git push origin main.`;}
$('refreshFiles').onclick=loadRepoFiles;

function readLayout(){const d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null')||DEFAULTS;$('accentInput').value=d.accent;$('accent2Input').value=d.accent2;$('radiusInput').value=d.radius;$('sidebarInput').value=d.sidebar;$('densityInput').value=d.density;return d}
function getLayout(){return{accent:$('accentInput').value.trim()||DEFAULTS.accent,accent2:$('accent2Input').value.trim()||DEFAULTS.accent2,radius:Number($('radiusInput').value||18),sidebar:Number($('sidebarInput').value||260),density:$('densityInput').value||'balanced',font:DEFAULTS.font}}
function previewLayout(){const d=getLayout(),p=$('layoutPreview');p.style.setProperty('--preview-accent',d.accent);p.style.gridTemplateColumns=`${Math.max(120,Math.min(360,d.sidebar/1.4))}px 1fr`;p.style.borderRadius=Math.max(6,Math.min(36,d.radius))+'px';document.querySelectorAll('.preview-main div').forEach((el,i)=>{el.style.height=(42+i*(d.density==='compact'?5:d.density==='airy'?14:9))+'px';el.style.borderColor=d.accent+'55'});}
$('applyLayout').onclick=()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));previewLayout();};
$('publishLayout').onclick=()=>{if(!isOwner())return;const d=getLayout();localStorage.setItem(LAYOUT_KEY,JSON.stringify(d));const content=JSON.stringify(d,null,2);const blob=new Blob([content],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='site-layout.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('layoutMsg').textContent='Downloaded site-layout.json. Replace the project file in Nimbus_CLEAN, then git add, git commit, git push origin main. Netlify will redeploy it.';}
$('resetLayout').onclick=()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();previewLayout()};
['accentInput','accent2Input','radiusInput','sidebarInput','densityInput'].forEach(id=>$(id).addEventListener('input',previewLayout));readLayout();previewLayout();
