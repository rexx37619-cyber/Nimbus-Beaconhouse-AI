const MODELS={
  ror:{id:'ror',label:'Nimbus 4.5 ROR',sub:'Gemini 3.5 Flash-Lite • Rapid + ultra modifications'},
  legacy:{id:'legacy',label:'Nimbus 0.24',sub:'Legacy Nimbus model'}
};
const RESOURCES=[
  ['Beaconhouse main site','https://www.beaconhouse.net/'],
  ['About Beaconhouse','https://www.beaconhouse.net/about-us/'],
  ['Academics & programmes','https://www.beaconhouse.net/academic/'],
  ['Academic archive','https://www.beaconhouse.net/academic-programs/'],
  ['Learner Profile','https://www.beaconhouse.net/beaconhouse-learner-profile/'],
  ['Clubs & Societies','https://www.beaconhouse.net/clubs-and-societies/'],
  ['Access Centre','https://www.beaconhouse.net/the-access-centre/'],
  ['Sports competitions','https://www.beaconhouse.net/sports-competition/'],
  ['STEAM competitions','https://www.beaconhouse.net/steam-competition/'],
  ['BISC results','https://www.beaconhouse.net/results/'],
  ['Educational trips','https://www.beaconhouse.net/education-trips/'],
  ['Internship programme','https://www.beaconhouse.net/internship-programme/'],
  ['University placements & scholarships','https://www.beaconhouse.net/university-placements-scholarships/'],
  ['Student protection & safeguarding','https://www.beaconhouse.net/child-protection/'],
  ['PYP / IB programme','https://www.beaconhouse.net/international-baccalaureate-programs/pyp/'],
  ['CIE A Level','https://www.beaconhouse.net/cie-a-level/'],
  ['BEAMS','https://beams.beaconhouse.net/home/'],
  ['Book-pack resource (BEAMS example)','https://beams.beaconhouse.net/parents/book-pack-letter/30_4/Class%207.pdf'],
  ['Beaconhouse Old Students Society','https://boss.beaconhouse.net/about-us/'],
  ['Learner Agency Paradigm','https://lap.beaconhouse.net/about-us/']
];

const state={
  id:localStorage.getItem('nimbus_id')||'',
  messages:[],
  chats:JSON.parse(localStorage.getItem('nimbus_chats')||'[]'),
  file:null,
  currentChatId:null,
  model:localStorage.getItem('nimbus_model')||'ror',
  used:Number(localStorage.getItem('nimbus_used')||0)
};
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function activeModel(){return MODELS[state.model]||MODELS.ror}
function saveChats(){localStorage.setItem('nimbus_chats',JSON.stringify(state.chats.slice(0,40)))}
function renderHistory(){const h=$('chatHistory');h.innerHTML='';state.chats.forEach(c=>{const b=document.createElement('button');b.className='history-item'+(c.id===state.currentChatId?' active':'');b.textContent=c.title||'New chat';b.onclick=()=>loadChat(c.id);h.appendChild(b)});}
function updateUsage(used){if(typeof used==='number'){state.used=used;localStorage.setItem('nimbus_used',String(used));}const pct=Math.min(100,(state.used/1500)*100);$('usageText').textContent=`${state.used.toLocaleString()} / 1,500 RPD`;$('usageBar').style.width=pct+'%';}
function renderModels(){const menu=$('modelMenu');menu.innerHTML=Object.values(MODELS).map(m=>`<button class="model-option ${m.id===state.model?'active':''}" data-model="${m.id}"><div><b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.sub)}</small></div>${m.id===state.model?'<span>✓</span>':''}</button>`).join('');$('activeModelLabel').textContent=activeModel().label;updateUsage();}
function resetChat(){state.messages=[];state.currentChatId=null;$('messages').innerHTML='';$('messages').classList.remove('show');$('welcome').classList.remove('hidden');renderHistory();}
function ensureChat(text){if(state.currentChatId)return;state.currentChatId=crypto.randomUUID?crypto.randomUUID():String(Date.now());state.chats.unshift({id:state.currentChatId,title:text.slice(0,42)+(text.length>42?'…':''),messages:[]});saveChats();renderHistory()}
function loadChat(id){const c=state.chats.find(x=>x.id===id);if(!c)return;state.currentChatId=id;state.messages=c.messages||[];$('messages').innerHTML='';state.messages.forEach(m=>renderMessage(m.role,m.text,m.fileName,false));if(state.messages.length){$('welcome').classList.add('hidden');$('messages').classList.add('show')}else{$('welcome').classList.remove('hidden');$('messages').classList.remove('show')}renderHistory();}
function persistCurrent(){const c=state.chats.find(x=>x.id===state.currentChatId);if(c){c.messages=state.messages;saveChats();}}
function renderMessage(role,text,fileName,scroll=true){$('welcome').classList.add('hidden');$('messages').classList.add('show');const d=document.createElement('div');d.className='message '+role;d.innerHTML=`<div class="message-bubble">${role==='ai'?'<div class="ai-tag">NIMBUS • '+escapeHtml(activeModel().label)+'</div>':''}${escapeHtml(text).replace(/\n/g,'<br>')}${fileName?`<div class="file-chip">📎 ${escapeHtml(fileName)}</div>`:''}</div>`;$('messages').appendChild(d);if(scroll)$('messages').scrollTop=$('messages').scrollHeight}
function add(role,text,fileName){state.messages.push({role,text,fileName:fileName||null});renderMessage(role,text,fileName);persistCurrent()}
async function sendMessage(text){
  const file=state.file;
  ensureChat(text||'Study file');
  add('user',text||'Please analyse my attachment.',file?.name);
  state.file=null;$('fileInput').value='';$('attachment').classList.add('hidden');$('sendBtn').disabled=true;$('messageInput').value='';$('messageInput').style.height='auto';
  try{
    let attachment=null;
    if(file){
      if(file.size>4*1024*1024) throw new Error('Please keep attachments below 4 MB.');
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      attachment={name:file.name,mimeType:file.type||'application/octet-stream',data:dataUrl.split(',')[1]};
    }
    const r=await fetch('/.netlify/functions/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text||'',educational_id:state.id||'anonymous',model:state.model,attachment})});
    const data=await r.json().catch(()=>({}));
    if(typeof data.used==='number') updateUsage(data.used);
    if(!r.ok) throw new Error(data.message||'Nimbus request failed.');
    if(data.limit_reached){add('ai',`Daily limit reached. You have used ${data.used||1500} of ${data.limit||1500} requests today.`);return;}
    add('ai',data.reply||'Nimbus did not return a response.');
  }catch(err){console.error(err);add('ai',err.message||'Nimbus could not connect right now.');}
  finally{$('sendBtn').disabled=false;}
}

$('composer').addEventListener('submit',e=>{e.preventDefault();const t=$('messageInput').value.trim();if(t||state.file)sendMessage(t)});
$('messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit()}});
$('messageInput').addEventListener('input',()=>{const el=$('messageInput');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,150)+'px'});
$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=()=>{const f=$('fileInput').files[0];if(!f)return;state.file=f;$('attachment').classList.remove('hidden');$('attachment').innerHTML=`📎 <b>${escapeHtml(f.name)}</b> · ${(f.size/1024).toFixed(1)} KB <button id="removeAttachment" style="float:right;border:0;background:none">×</button>`;$('removeAttachment').onclick=()=>{$('fileInput').value='';state.file=null;$('attachment').classList.add('hidden')}};

document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('messageInput').value=b.dataset.prompt;$('messageInput').focus()});
$('newChat').onclick=resetChat;$('clearChat').onclick=resetChat;$('clearAll').onclick=()=>{state.chats=[];saveChats();resetChat()};

$('modelPickerBtn').onclick=()=>{$('modelMenu').classList.toggle('hidden');$('modelPickerBtn').setAttribute('aria-expanded',String(!$('modelMenu').classList.contains('hidden')))};
document.addEventListener('click',e=>{const opt=e.target.closest('[data-model]');if(opt){state.model=opt.dataset.model;localStorage.setItem('nimbus_model',state.model);renderModels();$('modelMenu').classList.add('hidden');}});

function syncAccount(){const name='Beaconhouse student';$('accountName').textContent=name;$('accountId').textContent=state.id||'Educational ID';$('accountAvatar').textContent=(state.id||'B').slice(0,1).toUpperCase();$('topAccount').textContent=(state.id||'B').slice(0,1).toUpperCase();$('menuName').textContent=name;$('menuId').textContent=state.id||'Educational ID';$('menuAvatar').textContent=(state.id||'B').slice(0,1).toUpperCase()}

$('enterNimbus').onclick=async()=>{const id=$('eduId').value.trim();if(!/^\S+@(bh|beaconite)\.edu\.pk$/i.test(id)){alert('Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk.');return;}try{const r=await fetch('/.netlify/functions/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({educational_id:id})});const d=await r.json();if(r.ok&&d.ok){state.id=id;localStorage.setItem('nimbus_id',id);$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');syncAccount();renderHistory();if(state.chats.length)loadChat(state.chats[0].id)}else alert(d.message||'Authentication unavailable.')}catch{alert('Nimbus authentication is temporarily unavailable.')}};

$('accountBtn').onclick=$('topAccount').onclick=()=>$('menuModal').classList.remove('hidden');
$('closeMenu').onclick=()=>$('menuModal').classList.add('hidden');
$('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');
$('desktopSidebarToggle').onclick=()=>{$('sidebar').classList.toggle('collapsed');document.body.classList.toggle('sidebar-hidden');};
$('clearChat').onclick=resetChat;

$('helpBtn').onclick=()=>openInfo();
$('infoBtn').onclick=()=>openInfo();
function openInfo(){$('infoModal').classList.remove('hidden');const grid=$('resourceLinks');grid.innerHTML=RESOURCES.map(([t,u])=>`<a href="${u}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(t)}</b><small>${escapeHtml(u)}</small></a>`).join('');}
$('closeInfo').onclick=()=>$('infoModal').classList.add('hidden');
$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))$('infoModal').classList.add('hidden')});

$('signOut').onclick=()=>{localStorage.removeItem('nimbus_id');location.reload()};
$('ownerBtn').onclick=()=>{$('menuModal').classList.add('hidden');$('ownerModal').classList.remove('hidden');};
$('closeOwner').onclick=()=>$('ownerModal').classList.add('hidden');
$('ownerLogin').onclick=async()=>{const email=$('ownerEmail').value.trim();if(!email){$('ownerMsg').textContent='Enter an owner email.';return}$('ownerMsg').textContent='Checking…';try{const r=await fetch('/.netlify/functions/admin-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok||!d.ok){$('ownerMsg').textContent=d.message||'Owner access denied.';return}$('ownerDashboard').classList.remove('hidden');$('ownerMsg').textContent='Owner email authorized.';$('ownerDashboard').innerHTML=`<div class="stats"><div class="stat"><span>MONTHLY REVENUE</span><b>$${Number(d.metrics.monthly_revenue||0).toLocaleString()}</b></div><div class="stat"><span>MESSAGES TODAY</span><b>${Number(d.metrics.messages_today||0).toLocaleString()}</b></div><div class="stat"><span>DAILY LIMIT / USER</span><b>${Number(d.metrics.daily_limit||1500).toLocaleString()}</b></div><div class="stat"><span>ACTIVE MODELS</span><b>${Number(d.metrics.active_models||2)}</b></div></div><div class="admin-section"><h3>Owner account</h3><p>${escapeHtml(d.email)} is on the server-side owner allowlist.</p></div>`}catch{$('ownerMsg').textContent='Server unavailable.'}};

function init(){syncAccount();renderHistory();renderModels();if(state.id){$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');if(state.chats.length)loadChat(state.chats[0].id)}}
init();
