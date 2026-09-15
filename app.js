const MODELS={
  ror:{id:'ror',label:'Nimbus 4.5 ROR',sub:'Rapid • Ultra modifications'},
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
  ['BISC','https://bisc.beaconhouse.net/'],
  ['BISC About','https://bisc.beaconhouse.net/about-bisc/'],
  ['BISC results','https://www.beaconhouse.net/results/'],
  ['RISE competitions','https://rise.beaconhouse.net/'],
  ['Educational trips','https://www.beaconhouse.net/education-trips/'],
  ['International events & trips','https://www.beaconhouse.net/international-events-trips/'],
  ['Internship programme','https://www.beaconhouse.net/internship-programme/'],
  ['University placements & scholarships','https://www.beaconhouse.net/university-placements-scholarships/'],
  ['Student protection & safeguarding','https://www.beaconhouse.net/child-protection/'],
  ['PYP / IB programme','https://www.beaconhouse.net/international-baccalaureate-programs/pyp/'],
  ['CIE A Level','https://www.beaconhouse.net/cie-a-level/'],
  ['BEAMS','https://beams.beaconhouse.net/home/'],
  ['BEAMS PRISM','https://beams.beaconhouse.net/prism/'],
  ['Learner Agency Paradigm','https://lap.beaconhouse.net/about-us/'],
  ['LAP guidelines 2026','https://lap.beaconhouse.net/guidelines-2/'],
  ['LAP guidelines 2027','https://lap.beaconhouse.net/guidelines-ilap-2027/'],
  ['Beaconhouse Old Students Society','https://boss.beaconhouse.net/about-us/'],
  ['2026-27 Punjab book lists (Class 1-8 selector)','https://booklist.beaconhouse.net/punjab-booklist/'],
  ['2026-27 Sindh & Balochistan book lists (Class 1-8 selector)','https://booklist.beaconhouse.net/sindh-balochistan-booklist/'],
  ['2026-27 Fed/ICT book lists','https://booklist.beaconhouse.net/ict-booklist/'],
  ['2026-27 KPK book lists','https://booklist.beaconhouse.net/kpk-booklist/'],
  ['2026-27 TNS book lists','https://booklist.beaconhouse.net/tns-booklist/'],
  ['2026-27 Newlands Karachi book lists','https://booklist.beaconhouse.net/newlands-booklist-khi/'],
  ['2026-27 Newlands Islamabad book lists','https://booklist.beaconhouse.net/newlands-booklist-isb/'],
  ['2026-27 Newlands Lahore & Multan book lists','https://booklist.beaconhouse.net/newlands-booklist-ml/'],
  ['2026-27 Discovery Centre Karachi book lists','https://booklist.beaconhouse.net/discovery-karachi-booklist/'],
  ['2026-27 Book List portal','https://booklist.beaconhouse.net/'],
  ['Nimbus competition knowledge','/knowledge/beaconhouse_competitions_and_programmes.txt'],
  ['Nimbus BEAMS/LAP knowledge','/knowledge/beams_lap_and_services.txt'],
  ['Nimbus 2026 book-pack links','/knowledge/book_pack_2026_links.txt']
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
const escapeAttr=s=>escapeHtml(s).replace(/`/g,'&#96;');
function activeModel(){return MODELS[state.model]||MODELS.ror}
function saveChats(){localStorage.setItem('nimbus_chats',JSON.stringify(state.chats.slice(0,40)))}

function renderHistory(){
  const h=$('chatHistory'); h.innerHTML='';
  state.chats.forEach(c=>{
    const b=document.createElement('button');
    b.className='history-item'+(c.id===state.currentChatId?' active':'');
    b.textContent=c.title||'New chat';
    b.onclick=()=>loadChat(c.id);
    h.appendChild(b);
  });
}

function updateUsage(used){
  if(typeof used==='number'){
    state.used=used;
    localStorage.setItem('nimbus_used',String(used));
  }
  const pct=Math.min(100,(state.used/1500)*100);
  $('usageText').textContent=`${state.used.toLocaleString()} / 1,500 RPD`;
  $('usageBar').style.width=pct+'%';
  if($('menuUsageText')) $('menuUsageText').textContent=`${state.used.toLocaleString()} / 1,500 RPD`;
  if($('menuUsageBar')) $('menuUsageBar').style.width=pct+'%';
}

function renderModels(){
  const menu=$('modelMenu');
  menu.innerHTML=Object.values(MODELS).map(m=>`
    <button class="model-option ${m.id===state.model?'active':''}" data-model="${m.id}">
      <div><b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.sub)}</small></div>
      ${m.id===state.model?'<span>✓</span>':''}
    </button>
  `).join('')+
  `<div class="model-usage">
      <div><span>Daily usage</span><b id="menuUsageText">${state.used.toLocaleString()} / 1,500 RPD</b></div>
      <div class="usage-track"><div id="menuUsageBar" class="usage-bar" style="width:${Math.min(100,(state.used/1500)*100)}%"></div></div>
   </div>`;
  $('activeModelLabel').textContent=activeModel().label;
  updateUsage();
}

function resetChat(){
  state.messages=[]; state.currentChatId=null;
  $('messages').innerHTML=''; $('messages').classList.remove('show');
  $('welcome').classList.remove('hidden'); renderHistory();
}

function ensureChat(text){
  if(state.currentChatId)return;
  state.currentChatId=crypto.randomUUID?crypto.randomUUID():String(Date.now());
  state.chats.unshift({id:state.currentChatId,title:text.slice(0,42)+(text.length>42?'…':''),messages:[]});
  saveChats(); renderHistory();
}

function formatAnswer(text){
  const src=String(text||'').replace(/\r\n/g,'\n');
  const out=[];
  let cursor=0;
  const fence=/```[ \t]*([A-Za-z0-9_+.#-]+)?[ \t]*\n?([\s\S]*?)```/g;
  let match;

  while((match=fence.exec(src))!==null){
    if(match.index>cursor) out.push({type:'text',value:src.slice(cursor,match.index)});
    const lang=(match[1]||guessLanguage(match[2])).trim() || 'text';
    const code=match[2].replace(/^\n/,'').replace(/\n[ \t]*$/,'');
    out.push({type:'code',lang,code});
    cursor=fence.lastIndex;
  }

  if(cursor<src.length) out.push({type:'text',value:src.slice(cursor)});
  return out.length?out:[{type:'text',value:src}];
}

function guessLanguage(code){
  const s=String(code||'').trim();
  if(/^(<!doctype html|<html[ >])/i.test(s)) return 'html';
  if(/^(const|let|var|function|import .* from|export |console\.)/m.test(s)) return 'javascript';
  if(/^(def |import |from .* import |print\()/m.test(s)) return 'python';
  if(/^(body|html|\.[\w-]+)\s*\{|@media|:[a-z-]+\s*;/m.test(s)) return 'css';
  if(/^(local |function |print\()|\bgame\b|\bInstance\b/m.test(s)) return 'lua';
  if(/^(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/im.test(s)) return 'sql';
  return '';
}

function plainTextToHtml(text){
  const escaped=escapeHtml(text);
  return escaped
    .replace(/\*\*/g,'')
    .replace(/`([^`]+)`/g,'<code class="inline-code">$1</code>')
    .replace(/\n/g,'<br>');
}

function makeAiBubble(text){
  const bubble=document.createElement('div');
  bubble.className='message-bubble ai-bubble';
  bubble.innerHTML=`
    <div class="ai-head">
      <div><div class="ai-tag">NIMBUS • ${escapeHtml(activeModel().label)}</div></div>
    </div>
    <div class="typing-area"></div>
    <div class="answer-actions hidden">
      <button data-action="copy">Copy</button>
      <button data-action="txt">Save TXT</button>
      <button data-action="pdf">Print / Save PDF</button>
    </div>`;
  bubble.dataset.rawText=String(text||'');
  return bubble;
}

function renderMessage(role,text,fileName,scroll=true,animate=false){
  $('welcome').classList.add('hidden'); $('messages').classList.add('show');
  const d=document.createElement('div'); d.className='message '+role;
  if(role==='ai'){
    const bubble=makeAiBubble(text);
    d.appendChild(bubble);
    $('messages').appendChild(d);
    const area=bubble.querySelector('.typing-area');
    formatAnswer(text).forEach(seg=>{
      if(seg.type==='code'){
        const wrap=document.createElement('div'); wrap.className='code-wrap';
        const language=(seg.lang||'text').toLowerCase();
        wrap.innerHTML=`<div class="code-head"><span>${escapeHtml(language)}</span><button data-copy-code>Copy</button></div><pre><code>${escapeHtml(seg.code)}</code></pre>`;
        area.appendChild(wrap);
        wrap.querySelector('[data-copy-code]').onclick=async()=>{await navigator.clipboard.writeText(seg.code);wrap.querySelector('[data-copy-code]').textContent='Copied';setTimeout(()=>wrap.querySelector('[data-copy-code]').textContent='Copy',900)};
      }else{
        const p=document.createElement('div'); p.className='answer-text'; p.innerHTML=plainTextToHtml(seg.value); area.appendChild(p);
      }
    });
    bubble.querySelector('.answer-actions').classList.remove('hidden');
  }else{
    const bubble=document.createElement('div'); bubble.className='message-bubble'; bubble.innerHTML=`${plainTextToHtml(text)}${fileName?`<div class="file-chip">📎 ${escapeHtml(fileName)}</div>`:''}`;
    d.appendChild(bubble); $('messages').appendChild(d);
  }
  if(scroll)$('messages').scrollTop=$('messages').scrollHeight;
  if(role==='ai'){
    const actions=d.querySelector('.answer-actions');
    if(actions){
      actions.querySelector('[data-action="copy"]').onclick=async()=>{await navigator.clipboard.writeText(text);actions.querySelector('[data-action="copy"]').textContent='Copied';setTimeout(()=>actions.querySelector('[data-action="copy"]').textContent='Copy',900)};
      actions.querySelector('[data-action="txt"]').onclick=()=>downloadText('nimbus-answer.txt',text);
      actions.querySelector('[data-action="pdf"]').onclick=()=>printPdf(text);
    }
  }
}
function downloadText(filename,text){
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function printPdf(text){
  const w=window.open('','_blank','width=900,height=700');
  if(!w)return;
  w.document.write(`<!doctype html><html><head><title>Nimbus answer</title><style>body{font-family:Arial,sans-serif;padding:42px;line-height:1.6;color:#17191d}pre{background:#111;color:#fff;padding:16px;border-radius:10px;white-space:pre-wrap}h1{font-size:20px}small{color:#777}</style></head><body><h1>Nimbus</h1><small>Beaconhouse Intelligence</small><hr><div>${plainTextToHtml(text)}</div></body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(),250);
}

function add(role,text,fileName){
  state.messages.push({role,text,fileName:fileName||null});
  renderMessage(role,text,fileName,true,role==='ai');
  if(role!=='ai') persistCurrent();
}

function loadChat(id){
  const c=state.chats.find(x=>x.id===id);if(!c)return;
  state.currentChatId=id;state.messages=c.messages||[];$('messages').innerHTML='';
  state.messages.forEach(m=>renderMessage(m.role,m.text,m.fileName,false,false));
  if(state.messages.length){$('welcome').classList.add('hidden');$('messages').classList.add('show')}else{$('welcome').classList.remove('hidden');$('messages').classList.remove('show')}
  renderHistory();
}
function persistCurrent(){const c=state.chats.find(x=>x.id===state.currentChatId);if(c){c.messages=state.messages;saveChats();}}


function setAgentThinking(isThinking){
  const panel=$('agentAssist');
  if(!panel) return;
  panel.classList.toggle('hidden',!isThinking);
  if(isThinking){
    const msg=$('messages');
    if(msg) msg.scrollTop=msg.scrollHeight;
  }
}

async function sendMessage(text){
  const file=state.file;
  ensureChat(text||'Study file');
  add('user',text||'Please analyse my attachment.',file?.name);
  state.file=null;$('fileInput').value='';$('attachment').classList.add('hidden');$('sendBtn').disabled=true;setAgentThinking(true);$('messageInput').value='';$('messageInput').style.height='auto';
  try{
    let attachment=null;
    if(file){
      if(file.size>4*1024*1024) throw new Error('Please keep attachments below 4 MB.');
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      attachment={name:file.name,mimeType:file.type||'application/octet-stream',data:dataUrl.split(',')[1]};
    }
    const r=await fetch('/.netlify/functions/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text||'',educational_id:state.id||'anonymous',model:state.model,attachment})});
    const data=await r.json().catch(()=>({}));
    if(typeof data.used==='number')updateUsage(data.used);
    if(!r.ok)throw new Error(data.message||'Nimbus request failed.');
    if(data.limit_reached){add('ai',`Daily limit reached. You have used ${data.used||1500} of ${data.limit||1500} requests today.`);return;}
    add('ai',data.reply||'Nimbus did not return a response.');
  }catch(err){console.error(err);add('ai','I’m ready to help. Please try that again in a moment.');}
  finally{$('sendBtn').disabled=false;setAgentThinking(false);}
}

$('composer').addEventListener('submit',e=>{e.preventDefault();const t=$('messageInput').value.trim();if(t||state.file)sendMessage(t)});
$('messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit()}});
$('messageInput').addEventListener('input',()=>{const el=$('messageInput');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,150)+'px'});
$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=()=>{const f=$('fileInput').files[0];if(!f)return;state.file=f;$('attachment').classList.remove('hidden');$('attachment').innerHTML=`📎 <b>${escapeHtml(f.name)}</b> · ${(f.size/1024).toFixed(1)} KB <button id="removeAttachment" style="float:right;border:0;background:none">×</button>`;$('removeAttachment').onclick=()=>{$('fileInput').value='';state.file=null;$('attachment').classList.add('hidden')}};

document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('messageInput').value=b.dataset.prompt;$('messageInput').focus()});
$('newChat').onclick=resetChat;$('clearChat').onclick=resetChat;$('clearAll').onclick=()=>{state.chats=[];saveChats();resetChat()};

$('modelPickerBtn').addEventListener('click',e=>{
  e.preventDefault();
  e.stopPropagation();
  const menu=$('modelMenu');
  const willOpen=menu.classList.contains('hidden');
  menu.classList.toggle('hidden',!willOpen);
  $('modelPickerBtn').setAttribute('aria-expanded',String(willOpen));
});
$('modelMenu').addEventListener('click',e=>{
  e.stopPropagation();
  const opt=e.target.closest('[data-model]');
  if(!opt)return;
  state.model=opt.dataset.model;
  localStorage.setItem('nimbus_model',state.model);
  renderModels();
  $('modelMenu').classList.remove('hidden');
});
document.addEventListener('click',e=>{
  if(!$('modelPicker').contains(e.target)){
    $('modelMenu').classList.add('hidden');
    $('modelPickerBtn').setAttribute('aria-expanded','false');
  }
});

function syncAccount(){const name='Beaconhouse student';$('accountName').textContent=name;$('accountId').textContent=state.id||'Educational ID';$('accountAvatar').textContent=(state.id||'B').slice(0,1).toUpperCase();$('topAccount').textContent=(state.id||'B').slice(0,1).toUpperCase();$('menuName').textContent=name;$('menuId').textContent=state.id||'Educational ID';$('menuAvatar').textContent=(state.id||'B').slice(0,1).toUpperCase()}

$('enterNimbus').onclick=async()=>{const id=$('eduId').value.trim();if(!/^\S+@(bh|beaconite)\.edu\.pk$/i.test(id)){alert('Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk.');return;}try{const r=await fetch('/.netlify/functions/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({educational_id:id})});const d=await r.json();if(r.ok&&d.ok){state.id=id;localStorage.setItem('nimbus_id',id);$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');syncAccount();renderHistory();if(state.chats.length)loadChat(state.chats[0].id)}else alert(d.message||'Authentication unavailable.')}catch{alert('Nimbus authentication is temporarily unavailable.')}};

$('accountBtn').onclick=$('topAccount').onclick=()=>$('menuModal').classList.remove('hidden');
$('closeMenu').onclick=()=>$('menuModal').classList.add('hidden');
$('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');
$('desktopSidebarToggle').onclick=()=>{$('sidebar').classList.toggle('collapsed');document.body.classList.toggle('sidebar-hidden');};

$('helpBtn').onclick=()=>openInfo();
$('infoBtn').onclick=()=>openInfo();
function openInfo(){$('infoModal').classList.remove('hidden');const grid=$('resourceLinks');grid.innerHTML=RESOURCES.map(([t,u])=>`<a href="${escapeAttr(u)}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(t)}</b><small>${escapeHtml(u)}</small></a>`).join('');}
$('closeInfo').onclick=()=>$('infoModal').classList.add('hidden');
$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))$('infoModal').classList.add('hidden')});

$('signOut').onclick=()=>{localStorage.removeItem('nimbus_id');location.reload()};
$('ownerBtn').onclick=()=>{$('menuModal').classList.add('hidden');$('ownerModal').classList.remove('hidden');};
$('closeOwner').onclick=()=>$('ownerModal').classList.add('hidden');
$('ownerLogin').onclick=async()=>{const email=$('ownerEmail').value.trim();if(!email){$('ownerMsg').textContent='Enter an owner email.';return}$('ownerMsg').textContent='Checking…';try{const r=await fetch('/.netlify/functions/admin-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok||!d.ok){$('ownerMsg').textContent=d.message||'Owner access denied.';return}$('ownerDashboard').classList.remove('hidden');$('ownerMsg').textContent='Owner email authorized.';$('ownerDashboard').innerHTML=`<div class="stats"><div class="stat"><span>MONTHLY REVENUE</span><b>$${Number(d.metrics.monthly_revenue||0).toLocaleString()}</b></div><div class="stat"><span>MESSAGES TODAY</span><b>${Number(d.metrics.messages_today||0).toLocaleString()}</b></div><div class="stat"><span>DAILY LIMIT / USER</span><b>${Number(d.metrics.daily_limit||1500).toLocaleString()}</b></div><div class="stat"><span>ACTIVE MODELS</span><b>${Number(d.metrics.active_models||2)}</b></div></div><div class="admin-section"><h3>Owner account</h3><p>${escapeHtml(d.email)} is on the server-side owner allowlist.</p></div>`}catch{$('ownerMsg').textContent='Server unavailable.'}};

function init(){syncAccount();renderHistory();renderModels();if(state.id){$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');if(state.chats.length)loadChat(state.chats[0].id)}}
init();
