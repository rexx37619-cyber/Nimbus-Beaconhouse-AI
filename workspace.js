const OWNER_LOCAL_KEY='nimbus_workspace_finance_v1';
const LAYOUT_KEY='nimbus_workspace_layout_v1';
const DEFAULTS={accent:'#6359ff',radius:18,sidebar:280,density:'balanced'};
const PREMIUM_LABEL='Nimbus 5.7 Lor';
const PREMIUM_MODEL_ID='gpt-6-astra';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session={user:null,role:'denied',permissions:[]};

function setSecurity(text,kind='wait'){
  $('securityBadge').textContent=`SECURITY CHECK: ${text}`;
  $('securityBadge').style.color=kind==='ok'?'#48d38a':kind==='bad'?'#ff6f7c':'#f0b24c';
}
function isOwner(){return session.role==='owner'}
function guardOwners(){document.querySelectorAll('.owner-only').forEach(el=>el.classList.toggle('hidden',!isOwner()));document.querySelectorAll('.owner-only-panel').forEach(el=>el.classList.toggle('hidden',!isOwner()));}

async function getPuterUser(){
  if(!window.puter) throw new Error('Puter.js did not load.');
  if(!puter.auth.isSignedIn()) return null;
  return await puter.auth.getUser();
}
async function getPuterEmail(){
  if(!window.puter) throw new Error('Puter.js did not load.');
  if(!puter.auth.isSignedIn()) return null;
  // Puter does not expose the account email in the basic getUser() object by default.
  // Explicit email permission returns the actual email address used by the workspace allowlist.
  if(typeof puter.perms?.requestEmail==='function'){
    const email=await puter.perms.requestEmail();
    if(email) return String(email).trim().toLowerCase();
  }
  if(typeof puter.perms?.request==='function'){
    const email=await puter.perms.request('email');
    if(email) return String(email).trim().toLowerCase();
  }
  return '';
}
async function authorize(user){
  const email=await getPuterEmail();
  if(!email) throw new Error('Nimbus needs permission to read your Puter account email so it can verify the workspace access list. Please allow Email access and try again.');
  const r=await fetch('/.netlify/functions/workspace-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok) throw new Error(d.message||'Workspace access denied.');
  session={user,role:d.role,permissions:d.permissions||[]};
  $('userEmail').textContent=email;
  $('rolePill').textContent=d.role.toUpperCase();
  $('roleNote').textContent=d.role==='owner'?'Full workspace access':'Agent-only worker access';
  $('overviewRole').textContent=d.role==='owner'?'Owner':'Worker';
  $('securityRoleTag').textContent=d.role==='owner'?'OWNER':'WORKER';
  $('serverState').textContent='Allowlisted';
  $('permissionState').textContent=d.permissions.join(' • ');
  $('puterState').textContent='Authenticated';
  guardOwners();
}

function openWorkspace(){ $('gate').classList.add('hidden');$('workspace').classList.remove('hidden'); }
function showDenied(msg){ $('gateMsg').textContent=msg; $('gateMsg').style.color='#ff808d'; setSecurity('DENIED','bad'); }
async function signIn(){
  $('signInBtn').disabled=true; $('gateMsg').textContent='Opening Puter sign-in…'; setSecurity('AUTHENTICATING');
  try{
    await puter.auth.signIn({request_auth:true});
    const user=await getPuterUser();
    await authorize(user);
    $('gateMsg').textContent=`Access granted as ${session.role}.`;
    setSecurity('VERIFIED','ok');
    openWorkspace();
  }catch(e){showDenied(e.message||'Authentication failed.');}
  finally{$('signInBtn').disabled=false;}
}
$('signInBtn').onclick=signIn;

if(window.puter?.auth?.isSignedIn?.()){
  getPuterUser().then(async u=>{
    if(!u)return;
    try{ await authorize(u); setSecurity('VERIFIED','ok'); openWorkspace(); }
    catch(e){ showDenied(e.message); }
  }).catch(()=>{});
}

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.classList.contains('hidden'))return;
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  $('tab-'+btn.dataset.tab).classList.add('active');
}));

function appendAgent(role,text){
  const el=document.createElement('div');el.className='agent-msg'+(role==='me'?' me':'');el.textContent=text;$('agentMessages').appendChild(el);$('agentMessages').scrollTop=$('agentMessages').scrollHeight;
}
$('agentForm').onsubmit=async e=>{
  e.preventDefault();
  const text=$('agentInput').value.trim();if(!text)return;
  appendAgent('me',text);$('agentInput').value='';
  appendAgent('ai','Working…');
  const last=$('agentMessages').lastElementChild;
  try{
    const response=await puter.ai.chat(text,{model:PREMIUM_MODEL_ID,reasoning_effort:'minimal',verbosity:'medium',temperature:0.4});
    const msg=response?.message?.content ?? response?.content ?? response;
    last.textContent=typeof msg==='string'?msg:JSON.stringify(msg,null,2);
  }catch(e){last.textContent='Nimbus 5.7 Lor is temporarily busy. Please try again.';console.error(e)}
};

function loadFinance(){
  const d=JSON.parse(localStorage.getItem(OWNER_LOCAL_KEY)||'{}');
  $('revenueInput').value=d.revenue??'';$('expenseInput').value=d.expenses??'';$('currencyInput').value=d.currency||'USD';renderFinance();
}
function renderFinance(){
  const revenue=Number($('revenueInput').value||0), expenses=Number($('expenseInput').value||0), profit=revenue-expenses;
  $('revenueText').textContent=`${$('currencyInput').value||'USD'} ${revenue.toLocaleString()}`;
  $('profitText').textContent=`${$('currencyInput').value||'USD'} ${profit.toLocaleString()}`;
  $('marginText').textContent=`${revenue?((profit/revenue)*100).toFixed(1):0}% margin`;
  $('revenueBar').style.width=(revenue?Math.min(100,Math.max(0,profit/revenue*100)):0)+'%';
}
['revenueInput','expenseInput','currencyInput'].forEach(id=>$(id).addEventListener('input',renderFinance));
$('saveFinance').onclick=()=>{localStorage.setItem(OWNER_LOCAL_KEY,JSON.stringify({revenue:Number($('revenueInput').value||0),expenses:Number($('expenseInput').value||0),currency:$('currencyInput').value||'USD'}));renderFinance()};
loadFinance();

async function loadPuterFile(path){
  const blob=await puter.fs.read(`/NimbusWorkspace/${path}`);return await blob.text();
}
async function savePuterFile(path,data){
  await puter.fs.write(`/NimbusWorkspace/${path}`,data,{createMissingParents:true,overwrite:true});
}
$('loadFile').onclick=async()=>{try{$('fileMsg').textContent='Loading…';$('fileEditor').value=await loadPuterFile($('fileSelect').value);$('fileMsg').textContent='Loaded from Puter FS.'}catch(e){$('fileMsg').textContent='File does not exist yet. You can create it by saving.';$('fileEditor').value=''}};
$('saveFile').onclick=async()=>{try{await savePuterFile($('fileSelect').value,$('fileEditor').value);$('fileMsg').textContent='Saved to private Puter workspace.'}catch(e){$('fileMsg').textContent='Could not save this file.';console.error(e)}};

function readLayout(){const d=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'null')||DEFAULTS;$('accentInput').value=d.accent;$('radiusInput').value=d.radius;$('sidebarInput').value=d.sidebar;$('densityInput').value=d.density;return d}
function getLayout(){return{accent:$('accentInput').value.trim()||DEFAULTS.accent,radius:Number($('radiusInput').value||18),sidebar:Number($('sidebarInput').value||280),density:$('densityInput').value||'balanced'}}
function previewLayout(){const d=getLayout();const preview=$('layoutPreview');preview.style.setProperty('--preview-accent',d.accent);preview.style.gridTemplateColumns=`${Math.max(120,Math.min(360,d.sidebar/1.4))}px 1fr`;preview.style.borderRadius=Math.max(6,Math.min(36,d.radius))+'px';const base=d.density==='compact'?8:d.density==='airy'?17:12;document.querySelectorAll('.preview-main div').forEach((el,i)=>{el.style.height=(42+i*base/2)+'px';el.style.borderRadius=Math.max(6,d.radius-5)+'px';el.style.borderColor=d.accent+'55'});}
$('applyLayout').onclick=()=>{localStorage.setItem(LAYOUT_KEY,JSON.stringify(getLayout()));previewLayout()};
$('saveLayout').onclick=async()=>{try{await savePuterFile('ui-layout.json',JSON.stringify(getLayout(),null,2));$('fileMsg').textContent='';alert('UI layout saved to Puter FS.')}catch(e){alert('Could not save the layout.')}};
$('resetLayout').onclick=()=>{localStorage.removeItem(LAYOUT_KEY);readLayout();previewLayout()};
['accentInput','radiusInput','sidebarInput','densityInput'].forEach(id=>$(id).addEventListener('input',previewLayout));readLayout();previewLayout();

// Keep the premium alias obvious without falsely hard-coding an unverified provider model name.
console.info(`${PREMIUM_LABEL} uses configurable Puter model id: ${PREMIUM_MODEL_ID}`);
