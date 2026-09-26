const MODELS={
  ror:{id:'ror',label:'Nimbus 4.5 ROR',sub:'Rapid • Ultra modifications'},
  legacy:{id:'legacy',label:'Nimbus 0.24',sub:'Legacy Nimbus model'},
  'nano-banana-2':{id:'nano-banana-2',label:'Nano Banana 2',sub:'Diagrams • Flowcharts • Visuals'}
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

const USAGE_LIMIT=1500;
const usageKey=()=>`nimbus_usage_24h_${String(state.id||'anonymous').toLowerCase()}`;
function readUsageWindow(){
  try{
    const raw=localStorage.getItem(usageKey());
    const d=raw?JSON.parse(raw):null;
    const now=Date.now();
    if(!d||!Number.isFinite(d.started)||now-d.started>=86400000){
      const fresh={used:0,started:now}; localStorage.setItem(usageKey(),JSON.stringify(fresh)); return fresh;
    }
    return {used:Math.max(0,Number(d.used)||0),started:d.started};
  }catch{return {used:0,started:Date.now()};}
}
function writeUsageWindow(d){try{localStorage.setItem(usageKey(),JSON.stringify(d));}catch{}}
const state={
  id:localStorage.getItem('nimbus_id')||'',
  messages:[],
  chats:JSON.parse(localStorage.getItem('nimbus_chats')||'[]'),
  file:null,
  currentChatId:null,
  model:localStorage.getItem('nimbus_model')||'ror',
  used:0,
  usageStarted:Date.now()
};
({used:state.used,started:state.usageStarted}=readUsageWindow());

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

function usageTimeLeft(){const left=Math.max(0,86400000-(Date.now()-state.usageStarted));const h=Math.floor(left/3600000),m=Math.floor((left%3600000)/60000);return `${h}h ${m}m`;}
function updateUsage(used){
  if(typeof used==='number') state.used=Math.max(0,Math.min(USAGE_LIMIT,used));
  writeUsageWindow({used:state.used,started:state.usageStarted});
  const pct=Math.min(100,(state.used/USAGE_LIMIT)*100);
  $('usageText').textContent=`${state.used.toLocaleString()} / ${USAGE_LIMIT.toLocaleString()} RPD`;
  $('usageBar').style.width=pct+'%';
  if($('menuUsageText')) $('menuUsageText').textContent=`${state.used.toLocaleString()} / ${USAGE_LIMIT.toLocaleString()} RPD • resets in ${usageTimeLeft()}`;
  if($('menuUsageBar')) $('menuUsageBar').style.width=pct+'%';
}
function consumeLocalUsage(){state.used=Math.min(USAGE_LIMIT,state.used+1);updateUsage();}

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

function createVisualCard(meta={}){const d=document.createElement('div');d.className='message ai';const bubble=document.createElement('div');bubble.className='message-bubble ai-bubble visual-bubble';const title=escapeHtml(meta.title||'Study visual');const type=escapeHtml(meta.type||'diagram');const keywords=escapeHtml(meta.keywords||'keywords only');bubble.innerHTML=`<div class="visual-card-head"><div><span class="visual-kicker">NANO BANANA 2 • VISUAL</span><strong>${title}</strong><small>${type} • ${keywords}</small></div><span class="visual-badge">IMAGE</span></div><div class="visual-loading" aria-live="polite"><span></span><span></span><span></span><div>Generating visual…</div></div>`;d.appendChild(bubble);$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight;return {d,bubble};}
function finishVisualCard(card,base64,mimeType,meta={}){if(!card?.bubble)return;const img=document.createElement('img');img.className='nimbus-visual-image';img.alt=`Nimbus ${meta.type||'diagram'}`;img.src=`data:${mimeType||'image/png'};base64,${base64}`;card.bubble.querySelector('.visual-loading')?.remove();card.bubble.appendChild(img);const note=document.createElement('div');note.className='visual-rephrase-note';note.textContent='Use the keywords and labels as study help, then rephrase the explanation in your own words.';card.bubble.appendChild(note);$('messages').scrollTop=$('messages').scrollHeight;}
function failVisualCard(card){if(!card?.bubble)return;const load=card.bubble.querySelector('.visual-loading');if(load){load.innerHTML='<div class="visual-fallback">Visual generation is unavailable right now.</div>';load.classList.add('visual-error');}}
function addVisualMessage(base64,mimeType,meta={}){const card=createVisualCard(meta);finishVisualCard(card,base64,mimeType,meta);}
function looksLikeSchoolWork(text){const s=String(text||'').toLowerCase();return /(homework|assignment|classwork|worksheet|study|studying|notes|revision|revise|exam|test|quiz|project|school|lesson|chapter|topic|explain|how does|why does|define|difference between|compare|biology|chemistry|physics|math|mathematics|history|geography|computer|programming|coding|python|javascript|html|css|lua|roblox|game|flowchart|diagram|concept map|process|steps)/i.test(s);}
function makeAutoVisualPrompt(userText,answerText){return `Create a polished professional 16:9 educational visual for this schoolwork request. Make it realistic, visually rich, colorful, presentation-quality, with meaningful subject imagery, icons, clear hierarchy, varied shapes, depth/lighting, clean arrows and short readable labels. Do not make a plain text-only diagram or a generic set of boxes. Use concise keywords rather than paragraphs. Topic/request: ${userText}. Key answer context: ${String(answerText||'').slice(0,1600)}. If it is code or game-development help, visualize the logic, system architecture, mechanics, or steps instead of reproducing long code.`;}
async function generateVisual(prompt,meta={}){
  const card=createVisualCard(meta);
  try{
    const r=await fetch('/api/visual',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,aspectRatio:'16:9',imageSize:'2K'})});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok&&d.data){
      finishVisualCard(card,d.data,d.mimeType||'image/png',meta);
      return true;
    }
    failVisualCard(card);
    return false;
  }catch(e){
    console.warn('Visual generation failed',e);
    failVisualCard(card);
    return false;
  }
}

async function sendMessage(text){
  const file=state.file;
  ensureChat(text||'Study file');
  add('user',text||'Please analyse my attachment.',file?.name);
  state.file=null;$('fileInput').value='';$('attachment').classList.add('hidden');$('sendBtn').disabled=true;setAgentThinking(true);$('messageInput').value='';$('messageInput').style.height='auto';
  try{
    if(state.used>=USAGE_LIMIT){add('ai',`Daily limit reached. Your 24-hour window resets in ${usageTimeLeft()}.`);return;}
    let attachment=null;
    if(file){
      if(file.size>4*1024*1024) throw new Error('Please keep attachments below 4 MB.');
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      attachment={name:file.name,mimeType:file.type||'application/octet-stream',data:dataUrl.split(',')[1]};
    }
    let r, data;
    if(state.model==='nano-banana-2'){
      const visualPrompt=`Create one clear student-friendly 16:9 educational diagram or flowchart for this request. Use concise keywords only, short labels, arrows, icons and no long paragraphs. Topic/request: ${text||'Study visual'}.`;
      const ok=await generateVisual(visualPrompt,{title:text||'Study visual',type:'diagram',keywords:'concise labels • arrows • key concepts'});
      if(ok) add('ai','Visual generated. Use the labels as study help and rephrase explanations in your own words.');
      consumeLocalUsage();
      return;
    }
    r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text||'',educational_id:state.id||'anonymous',model:state.model,attachment})});
    data=await r.json().catch(()=>({}));
    // The server may report a count when available; the client also maintains a 24-hour per-educational-ID window.
    if(typeof data.used==='number' && data.used>=state.used) updateUsage(data.used);
    if(!r.ok)throw new Error(data.message||'Nimbus request failed.');
    if(data.limit_reached){add('ai',`Daily limit reached. You have used ${data.used||1500} of ${data.limit||1500} requests today.`);return;}
    let reply=data.reply||'Nimbus did not return a response.';
    if(data.visual?.prompt || looksLikeSchoolWork(text) || /(flowchart|diagram|draw|image|visual|illustration|mind map|concept map|show me|make a chart)/i.test(String(text||''))){
      const vtype=data.visual?.type||(/flowchart|steps|process|sequence/i.test(text)?'flowchart':'diagram');
      const vtitle=data.visual?.title||'Study visual';
      const vkeywords=data.visual?.keywords||'keywords • labels • key concepts • arrows';
      add('ai',reply);
      const prompt=data.visual?.prompt||makeAutoVisualPrompt(text,reply);
      try{await generateVisual(prompt,{title:vtitle,type:vtype,keywords:vkeywords});}
      catch(e){console.warn('Visual generation failed',e);}
    }else add('ai',reply);
    consumeLocalUsage();
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

$('enterNimbus').onclick=()=>{const id=$('eduId').value.trim();if(!/^\S+@(bh|beaconite)\.edu\.pk$/i.test(id)){alert('Invalid Educational ID. Use an ID ending in @bh.edu.pk or @beaconite.edu.pk.');return;}state.id=id;localStorage.setItem('nimbus_id',id);({used:state.used,started:state.usageStarted}=readUsageWindow());updateUsage();$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');syncAccount();renderHistory();if(state.chats.length)loadChat(state.chats[0].id)};

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
$('ownerLogin').onclick=async()=>{const email=$('ownerEmail').value.trim();if(!email){$('ownerMsg').textContent='Enter an owner email.';return}$('ownerMsg').textContent='Checking…';try{const r=await fetch('/api/admin-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok||!d.ok){$('ownerMsg').textContent=d.message||'Owner access denied.';return}$('ownerDashboard').classList.remove('hidden');$('ownerMsg').textContent='Owner email authorized.';$('ownerDashboard').innerHTML=`<div class="stats"><div class="stat"><span>MONTHLY REVENUE</span><b>$${Number(d.metrics.monthly_revenue||0).toLocaleString()}</b></div><div class="stat"><span>MESSAGES TODAY</span><b>${Number(d.metrics.messages_today||0).toLocaleString()}</b></div><div class="stat"><span>DAILY LIMIT / USER</span><b>${Number(d.metrics.daily_limit||1500).toLocaleString()}</b></div><div class="stat"><span>ACTIVE MODELS</span><b>${Number(d.metrics.active_models||2)}</b></div></div><div class="admin-section"><h3>Owner account</h3><p>${escapeHtml(d.email)} is on the server-side owner allowlist.</p></div>`}catch{$('ownerMsg').textContent='Server unavailable.'}};

function init(){syncAccount();renderHistory();renderModels();if(state.id){$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');if(state.chats.length)loadChat(state.chats[0].id)}}
init();


// Public Premium Models — Nimbus 5.7 Lor via Puter.js
const PREMIUM_PUBLIC_LABEL='Nimbus 5.7 Lor';
const PREMIUM_PUBLIC_MODEL='gpt-6-astra';
let premiumReady=false;
async function openPremium(){
  $('premiumModal').classList.remove('hidden');
  $('premiumStatus').textContent='Checking availability…';
  try{
    if(!window.puter) throw new Error('Puter.js unavailable');
    if(!puter.auth.isSignedIn()){
      await puter.auth.signIn({request_auth:true});
    }
    const models=await puter.ai.listModels();
    const exact=models.find(m=>String(m.id||'').toLowerCase()===PREMIUM_PUBLIC_MODEL);
    premiumReady=Boolean(exact);
    if(exact){
      $('premiumStatus').textContent='Available';
    }else{
      $('premiumStatus').textContent='Not currently exposed by Puter';
      const providers=[...new Set(models.map(m=>m.provider).filter(Boolean))].join(', ');
      appendPremium('ai',`Nimbus 5.7 Lor is enabled as the premium label, but Puter is not currently exposing ${PREMIUM_PUBLIC_MODEL} to this app. Available providers: ${providers||'unknown'}.`);
    }
  }catch(e){
    premiumReady=false;
    $('premiumStatus').textContent='Sign-in required';
    appendPremium('ai','Please sign in to Puter to use Nimbus 5.7 Lor.');
  }
}
function appendPremium(role,text){
  const el=document.createElement('div');el.className='premium-msg '+(role==='me'?'me':'ai');el.textContent=text;$('premiumMessages').appendChild(el);$('premiumMessages').scrollTop=$('premiumMessages').scrollHeight;
}
$('premiumModelsBtn').addEventListener('click',openPremium);
$('closePremium').addEventListener('click',()=>$('premiumModal').classList.add('hidden'));
$('premiumModal').addEventListener('click',e=>{if(e.target===$('premiumModal'))$('premiumModal').classList.add('hidden')});
$('premiumComposer').addEventListener('submit',async e=>{
  e.preventDefault(); const text=$('premiumInput').value.trim(); if(!text)return;
  appendPremium('me',text); $('premiumInput').value='';
  const wait=document.createElement('div'); wait.className='premium-msg ai'; wait.innerHTML='<span class="premium-thinking"><i></i><i></i><i></i></span>'; $('premiumMessages').appendChild(wait);
  try{
    if(!window.puter) throw new Error('Puter.js unavailable');
    if(!puter.auth.isSignedIn()) await puter.auth.signIn({request_auth:true});
    const models=await puter.ai.listModels();
    const exact=models.find(m=>String(m.id||'').toLowerCase()===PREMIUM_PUBLIC_MODEL);
    if(!exact){wait.textContent='Nimbus 5.7 Lor is not currently available through Puter for this account.';return;}
    const response=await puter.ai.chat(text,{model:exact.id,reasoning_effort:'minimal',stream:false});
    const msg=response?.message?.content??response?.content??response;
    wait.textContent=typeof msg==='string'?msg:JSON.stringify(msg,null,2);
  }catch(err){wait.textContent='Nimbus 5.7 Lor is temporarily busy. Please try again.'; console.error(err)}
});

/* NIMBUS PUBLIC FINAL FIX */
(function(){
  "use strict";

  function installNimbusFinalFix(){
    if (window.__NIMBUS_PUBLIC_FINAL_FIX__) return;
    window.__NIMBUS_PUBLIC_FINAL_FIX__ = true;

    if (typeof state === "undefined") return;

    /* --------------------------------------------------------
       REMOVE OLD MEMORY UI IF A CACHED/OLD SCRIPT LEFT IT
       -------------------------------------------------------- */
    var oldControls = document.getElementById("nimbusCleanControls");
    if (oldControls) oldControls.remove();

    var oldMemory = document.getElementById("nimbusMemoryBtnClean");
    if (oldMemory) oldMemory.remove();

    /* --------------------------------------------------------
       MEMORY = AUTOMATIC PER ACTIVE CHAT
       No memory toggle button.
       The existing state.messages/state.chats remain the source.
       -------------------------------------------------------- */
    state.memoryEnabled = true;

    if (!window.__NIMBUS_FINAL_FETCH_PATCH__) {
      window.__NIMBUS_FINAL_FETCH_PATCH__ = true;

      var nativeFetch = window.fetch.bind(window);

      window.fetch = function(input, init){
        var url =
          typeof input === "string"
            ? input
            : ((input && input.url) || "");

        var method = String(
          (init && init.method) ||
          (typeof input !== "string" && input && input.method) ||
          "GET"
        ).toUpperCase();

        /* ------------------------------------------------------
           CHAT MEMORY + MODEL + SPEED
           ------------------------------------------------------ */
        if (
          method === "POST" &&
          url.indexOf("/api/chat") >= 0 &&
          init &&
          typeof init.body === "string"
        ) {
          try {
            var payload = JSON.parse(init.body);

            payload.model = state.model || payload.model || "ror";
            payload.memory_enabled = true;
            payload.speed_mode = state.speedMode || "xhigh";
            payload.chat_id = state.currentChatId || payload.chat_id || "";

            var all = Array.isArray(state.messages)
              ? state.messages.slice(0, -1)
              : [];

            var history = all
              .map(function(m){
                var role =
                  String(m && m.role || "").toLowerCase();

                return {
                  role: role === "ai" || role === "assistant"
                    ? "model"
                    : "user",
                  text: String(m && m.text || "").trim()
                };
              })
              .filter(function(m){
                return m.text;
              })
              .slice(-24);

            payload.history = history;

            /* Extra active-chat context for references such as:
               "what have we done so far?"
               "continue the quiz"
               "what was my last answer?"
            */
            var transcript = history
              .map(function(m){
                return (m.role === "model" ? "Nimbus" : "User") +
                  ": " + m.text;
              })
              .join("\n");

            payload.conversation_memory =
              "This is one continuous active chat. Continue from the conversation below. Do not reset the topic, quiz, task, or instructions. The user may refer to earlier turns without repeating them.\n\n" +
              transcript.slice(0, 7000);

            init = Object.assign({}, init, {
              body: JSON.stringify(payload)
            });
          } catch (_) {}
        }

        /* ------------------------------------------------------
           FLUX: BLANK LEADER LINES, NO TEXT
           ------------------------------------------------------ */
        if (
          method === "POST" &&
          url.indexOf("/api/visual") >= 0 &&
          init &&
          typeof init.body === "string"
        ) {
          try {
            var visualPayload = JSON.parse(init.body);
            var originalPrompt = String(
              visualPayload.prompt || ""
            );

            var noTextRule =
              "Create a student-friendly educational diagram using shapes, arrows, icons, and BLANK LEADER LINES only. Do NOT render any readable words, letters, numbers, labels, captions, alphabetic characters, logos, watermarks, signs, typography, glyphs, pseudo-writing, handwriting, or text-like marks anywhere in the artwork. Every label area must be an empty line with no writing. Never attempt to spell words. The student will identify and label the structures themselves.";

            if (
              originalPrompt.indexOf("BLANK LEADER LINES only") < 0
            ) {
              visualPayload.prompt =
                noTextRule + " " + originalPrompt;

              init = Object.assign({}, init, {
                body: JSON.stringify(visualPayload)
              });
            }
          } catch (_) {}
        }

        return nativeFetch(input, init);
      };
    }

    /* --------------------------------------------------------
       SPEED MODES INSIDE THE CHAT COMPOSER
       XHigh = 1 RPD
       Rapid = 2 RPD
       Super Rapid = 3 RPD
       -------------------------------------------------------- */
    state.speedMode =
      localStorage.getItem("nimbus_speed_mode") || "xhigh";

    if (
      state.speedMode !== "xhigh" &&
      state.speedMode !== "rapid" &&
      state.speedMode !== "super-rapid"
    ) {
      state.speedMode = "xhigh";
    }

    if (!window.__NIMBUS_FINAL_SPEED_UI__) {
      window.__NIMBUS_FINAL_SPEED_UI__ = true;

      var sendBtn = document.getElementById("sendBtn");
      var input = document.getElementById("messageInput");

      var host =
        (sendBtn && sendBtn.parentElement) ||
        (input && input.parentElement);

      if (host && !document.getElementById("nimbusSpeedControlFinal")) {
        if (!host.style.position) {
          host.style.position = "relative";
        }

        var speedWrap = document.createElement("div");
        speedWrap.id = "nimbusSpeedControlFinal";

        speedWrap.style.cssText =
          "position:relative;display:inline-flex;align-items:center;margin-right:7px;flex:0 0 auto;";

        speedWrap.innerHTML =
          '<button type="button" id="nimbusSpeedBtnFinal" aria-haspopup="true" aria-expanded="false" style="' +
          'border:1px solid rgba(124,92,255,.45);' +
          'background:linear-gradient(135deg,rgba(124,92,255,.18),rgba(0,210,255,.12));' +
          'color:inherit;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;' +
          'white-space:nowrap;">XHigh ▾</button>' +

          '<div id="nimbusSpeedMenuFinal" style="' +
          'display:none;position:absolute;right:0;bottom:calc(100% + 8px);' +
          'min-width:185px;padding:6px;border-radius:12px;' +
          'background:#ffffff;color:#111111;border:1px solid rgba(0,0,0,.12);' +
          'box-shadow:0 14px 40px rgba(0,0,0,.35);z-index:100000;">' +

          '<button type="button" data-speed="xhigh" style="' +
          'display:flex;width:100%;align-items:center;gap:8px;padding:9px;border:0;background:transparent;color:inherit;border-radius:8px;cursor:pointer;text-align:left;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#7c5cff;"></span>' +
          '<span style="flex:1"><b>XHigh</b><small style="display:block;opacity:.65;">Normal • 1 RPD</small></span>' +
          '</button>' +

          '<button type="button" data-speed="rapid" style="' +
          'display:flex;width:100%;align-items:center;gap:8px;padding:9px;border:0;background:transparent;color:inherit;border-radius:8px;cursor:pointer;text-align:left;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#00d2ff;"></span>' +
          '<span style="flex:1"><b>Rapid</b><small style="display:block;opacity:.65;">Faster • 2 RPD</small></span>' +
          '</button>' +

          '<button type="button" data-speed="super-rapid" style="' +
          'display:flex;width:100%;align-items:center;gap:8px;padding:9px;border:0;background:transparent;color:inherit;border-radius:8px;cursor:pointer;text-align:left;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#ff4fd8;"></span>' +
          '<span style="flex:1"><b>Super Rapid</b><small style="display:block;opacity:.65;">Fastest • 3 RPD</small></span>' +
          '</button>' +

          '</div>';

        if (sendBtn) {
          host.insertBefore(speedWrap, sendBtn);
        } else {
          host.appendChild(speedWrap);
        }

        var speedBtn =
          document.getElementById("nimbusSpeedBtnFinal");

        var speedMenu =
          document.getElementById("nimbusSpeedMenuFinal");

        function speedLabel(){
          if (state.speedMode === "rapid") return "Rapid";
          if (state.speedMode === "super-rapid") return "Super Rapid";
          return "XHigh";
        }

        function syncSpeed(){
          if (!speedBtn) return;
          speedBtn.textContent = speedLabel() + " ▾";
        }

        if (speedBtn && speedMenu) {
          speedBtn.addEventListener("click", function(e){
            e.preventDefault();
            e.stopPropagation();

            var open =
              speedMenu.style.display === "block";

            speedMenu.style.display =
              open ? "none" : "block";

            speedBtn.setAttribute(
              "aria-expanded",
              String(!open)
            );
          });

          speedMenu.addEventListener("click", function(e){
            var option =
              e.target &&
              e.target.closest &&
              e.target.closest("[data-speed]");

            if (!option) return;

            state.speedMode =
              option.dataset.speed || "xhigh";

            localStorage.setItem(
              "nimbus_speed_mode",
              state.speedMode
            );

            speedMenu.style.display = "none";
            speedBtn.setAttribute(
              "aria-expanded",
              "false"
            );

            syncSpeed();
          });

          syncSpeed();
        }

        document.addEventListener("click", function(){
          if (speedMenu) {
            speedMenu.style.display = "none";
            if (speedBtn) {
              speedBtn.setAttribute(
                "aria-expanded",
                "false"
              );
            }
          }
        });
      }
    }

    /* --------------------------------------------------------
       RPD COST
       -------------------------------------------------------- */
    if (
      typeof consumeLocalUsage === "function" &&
      !window.__NIMBUS_FINAL_USAGE_PATCH__
    ) {
      window.__NIMBUS_FINAL_USAGE_PATCH__ = true;

      consumeLocalUsage = function(){
        var cost = 1;

        if (state.speedMode === "rapid") {
          cost = 2;
        } else if (state.speedMode === "super-rapid") {
          cost = 3;
        }

        state.used =
          Math.min(
            USAGE_LIMIT,
            state.used + cost
          );

        updateUsage();
      };
    }

    /* --------------------------------------------------------
       MODEL DROPDOWN: FORCE CLICKABLE + VISIBLE
       -------------------------------------------------------- */
    if (!window.__NIMBUS_FINAL_MODEL_FIX__) {
      window.__NIMBUS_FINAL_MODEL_FIX__ = true;

      function getPicker(){
        return (
          document.getElementById("modelPickerBtn") ||
          document.querySelector("#modelPicker button")
        );
      }

      function getMenu(){
        return document.getElementById("modelMenu");
      }

      function placeMenu(){
        var picker = getPicker();
        var menu = getMenu();

        if (!picker || !menu) return;

        var r = picker.getBoundingClientRect();

        menu.style.position = "fixed";
        menu.style.left = Math.round(r.left) + "px";
        menu.style.top =
          Math.round(r.bottom + 7) + "px";
        menu.style.minWidth =
          Math.max(220, Math.round(r.width)) + "px";
        menu.style.zIndex = "2147483647";
        menu.style.overflow = "visible";
      }

      function closeModelMenu(){
        var menu = getMenu();
        var picker = getPicker();

        if (menu) {
          menu.classList.add("hidden");
          menu.style.display = "none";
        }

        if (picker) {
          picker.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }

      document.addEventListener("click", function(event){
        var target = event.target;

        var option =
          target &&
          target.closest &&
          target.closest("#modelMenu [data-model]");

        if (option) {
          event.preventDefault();
          event.stopImmediatePropagation();

          state.model =
            option.dataset.model || "ror";

          localStorage.setItem(
            "nimbus_model",
            state.model
          );

          if (typeof renderModels === "function") {
            renderModels();
          }

          closeModelMenu();
          return;
        }

        var picker = getPicker();

        if (
          picker &&
          target &&
          (target === picker ||
           (target.closest && target.closest("#modelPickerBtn") === picker))
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          var menu = getMenu();
          if (!menu) return;

          var opening =
            menu.classList.contains("hidden") ||
            window.getComputedStyle(menu).display === "none";

          if (opening) {
            menu.classList.remove("hidden");
            menu.style.display = "block";
            menu.style.visibility = "visible";
            placeMenu();

            picker.setAttribute(
              "aria-expanded",
              "true"
            );
          } else {
            closeModelMenu();
          }

          return;
        }

        var menu = getMenu();

        if (
          menu &&
          target &&
          !(target.closest && target.closest("#modelMenu"))
        ) {
          closeModelMenu();
        }
      }, true);

      window.addEventListener("resize", placeMenu);
      window.addEventListener("scroll", placeMenu, true);

      var picker = getPicker();

      if (picker) {
        picker.style.pointerEvents = "auto";
        picker.style.position = "relative";
        picker.style.zIndex = "2147483646";
        picker.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installNimbusFinalFix,
      {once:true}
    );
  } else {
    installNimbusFinalFix();
  }
})();

/* NIMBUS CHAT MEDIA PERSISTENCE V2 */
(function(){
  "use strict";

  if (window.__NIMBUS_CHAT_MEDIA_PERSISTENCE_V2__) return;
  window.__NIMBUS_CHAT_MEDIA_PERSISTENCE_V2__ = true;

  var DB_NAME = "nimbus_chat_media_v2";
  var STORE_NAME = "visuals";

  function openDB(){
    return new Promise(function(resolve,reject){
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }

      var request = indexedDB.open(DB_NAME,1);

      request.onupgradeneeded = function(event){
        var db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME,{keyPath:"id"});
        }
      };

      request.onsuccess = function(){
        resolve(request.result);
      };

      request.onerror = function(){
        reject(request.error || new Error("IndexedDB open failed"));
      };
    });
  }

  function saveVisual(id,base64,mimeType,meta){
    return openDB().then(function(db){
      return new Promise(function(resolve,reject){
        var tx = db.transaction(STORE_NAME,"readwrite");

        tx.objectStore(STORE_NAME).put({
          id:id,
          base64:base64,
          mimeType:mimeType || "image/jpeg",
          meta:meta || {},
          savedAt:Date.now()
        });

        tx.oncomplete = function(){
          db.close();
          resolve();
        };

        tx.onerror = function(){
          db.close();
          reject(
            tx.error || new Error("Visual save failed")
          );
        };
      });
    });
  }

  function readVisual(id){
    return openDB().then(function(db){
      return new Promise(function(resolve,reject){
        var tx = db.transaction(STORE_NAME,"readonly");

        var request =
          tx.objectStore(STORE_NAME).get(id);

        request.onsuccess = function(){
          db.close();
          resolve(request.result || null);
        };

        request.onerror = function(){
          db.close();
          reject(
            request.error || new Error("Visual read failed")
          );
        };
      });
    });
  }

  function currentChat(){
    if (
      typeof state === "undefined" ||
      !state.currentChatId ||
      !Array.isArray(state.chats)
    ) {
      return null;
    }

    return state.chats.find(function(chat){
      return chat.id === state.currentChatId;
    }) || null;
  }

  function saveChatMetadata(record){
    var chat = currentChat();

    if (!chat) return;

    if (!Array.isArray(chat.visuals)) {
      chat.visuals = [];
    }

    var exists = chat.visuals.some(function(item){
      return item.id === record.id;
    });

    if (!exists) {
      chat.visuals.push(record);
    }

    if (typeof saveChats === "function") {
      saveChats();
    }
  }

  function makeVisualId(){
    return "visual-" +
      (
        crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) +
            "-" +
            Math.random().toString(36).slice(2)
      );
  }

  function placeCard(card,messageIndex){
    if (
      !card ||
      !card.d ||
      typeof document === "undefined"
    ) {
      return;
    }

    var messages = document.getElementById("messages");
    if (!messages) return;

    var messageNodes = Array.prototype.filter.call(
      messages.children,
      function(node){
        return node.classList &&
          node.classList.contains("message");
      }
    );

    var index = Number.isFinite(messageIndex)
      ? Math.max(0,messageIndex)
      : messageNodes.length;

    if (index >= messageNodes.length) {
      messages.appendChild(card.d);
    } else {
      messages.insertBefore(
        card.d,
        messageNodes[index]
      );
    }

    messages.scrollTop = messages.scrollHeight;
  }

  /* ------------------------------------------------------------
     SAVE EVERY NEW GENERATED IMAGE
     We hook the final image renderer, which is the common point
     used by the existing visual-generation flow.
     ------------------------------------------------------------ */
  if (
    typeof finishVisualCard === "function" &&
    !window.__NIMBUS_FINISH_VISUAL_V2__
  ) {
    window.__NIMBUS_FINISH_VISUAL_V2__ = true;

    var originalFinishVisualCard =
      finishVisualCard;

    finishVisualCard = function(
      card,
      base64,
      mimeType,
      meta
    ){
      var result =
        originalFinishVisualCard.apply(
          this,
          arguments
        );

      try {
        if (
          card &&
          !card.__nimbusRestoringVisual &&
          base64 &&
          state &&
          state.currentChatId
        ) {
          var id = makeVisualId();

          card.__nimbusVisualId = id;

          var messageIndex =
            Array.isArray(state.messages)
              ? state.messages.length
              : 0;

          saveChatMetadata({
            id:id,
            mimeType:mimeType || "image/jpeg",
            meta:meta || {},
            messageIndex:messageIndex
          });

          saveVisual(
            id,
            base64,
            mimeType || "image/jpeg",
            meta || {}
          ).catch(function(error){
            console.warn(
              "Nimbus visual storage failed:",
              error
            );
          });
        }
      } catch (error) {
        console.warn(
          "Nimbus visual persistence error:",
          error
        );
      }

      return result;
    };
  }

  /* ------------------------------------------------------------
     RESTORE VISUALS WHEN A SAVED CHAT IS OPENED
     ------------------------------------------------------------ */
  if (
    typeof loadChat === "function" &&
    !window.__NIMBUS_LOAD_CHAT_VISUALS_V2__
  ) {
    window.__NIMBUS_LOAD_CHAT_VISUALS_V2__ = true;

    var originalLoadChat = loadChat;

    loadChat = function(id){
      var result =
        originalLoadChat.apply(
          this,
          arguments
        );

      setTimeout(function(){
        try {
          var chat =
            Array.isArray(state.chats)
              ? state.chats.find(function(item){
                  return item.id === id;
                })
              : null;

          if (
            !chat ||
            !Array.isArray(chat.visuals) ||
            !chat.visuals.length
          ) {
            return;
          }

          var visuals =
            chat.visuals.slice().sort(
              function(a,b){
                var ai =
                  Number(a.messageIndex || 0);
                var bi =
                  Number(b.messageIndex || 0);

                if (ai !== bi) {
                  return ai - bi;
                }

                return Number(a.savedAt || 0) -
                  Number(b.savedAt || 0);
              }
            );

          visuals.forEach(function(record){
            readVisual(record.id)
              .then(function(saved){
                if (!saved) return;

                if (
                  typeof createVisualCard !== "function" ||
                  typeof finishVisualCard !== "function"
                ) {
                  return;
                }

                var card =
                  createVisualCard(
                    saved.meta || record.meta || {}
                  );

                card.__nimbusRestoringVisual = true;

                /* Use the original renderer so restoring an image
                   does NOT create another saved visual record. */
                if (
                  typeof originalFinishVisualCard === "function"
                ) {
                  originalFinishVisualCard(
                    card,
                    saved.base64,
                    saved.mimeType,
                    saved.meta || record.meta || {}
                  );
                }

                placeCard(
                  card,
                  Number(record.messageIndex || 0)
                );
              })
              .catch(function(error){
                console.warn(
                  "Nimbus visual restore failed:",
                  error
                );
              });
          });
        } catch (error) {
          console.warn(
            "Nimbus saved-visual restore error:",
            error
          );
        }
      },120);

      return result;
    };
  }

  /* Request persistent browser storage when supported. */
  try {
    if (
      navigator.storage &&
      navigator.storage.persist
    ) {
      navigator.storage.persist().catch(function(){});
    }
  } catch (_) {}

  /* Restore visuals for the chat already opened during init(). */
  setTimeout(function(){
    try {
      if (
        state &&
        state.currentChatId &&
        Array.isArray(state.chats)
      ) {
        var chat = currentChat();

        if (
          chat &&
          Array.isArray(chat.visuals) &&
          chat.visuals.length
        ) {
          chat.visuals.forEach(function(record){
            readVisual(record.id)
              .then(function(saved){
                if (!saved) return;

                if (
                  typeof createVisualCard !== "function" ||
                  typeof originalFinishVisualCard !== "function"
                ) {
                  return;
                }

                var card =
                  createVisualCard(
                    saved.meta || record.meta || {}
                  );

                card.__nimbusRestoringVisual = true;

                originalFinishVisualCard(
                  card,
                  saved.base64,
                  saved.mimeType,
                  saved.meta || record.meta || {}
                );

                placeCard(
                  card,
                  Number(record.messageIndex || 0)
                );
              })
              .catch(function(){});
          });
        }
      }
    } catch (_) {}
  },250);

})();
