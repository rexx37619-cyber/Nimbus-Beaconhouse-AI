const MODELS={
  ror:{id:'ror',label:'Nimbus 4.5 ROR',sub:'Rapid • Ultra modifications'},
  legacy:{id:'legacy',label:'Nimbus 0.24',sub:'Legacy Nimbus model'},
  'nano-banana-2':{id:'nano-banana-2',label:'FLUX',sub:'Diagrams • Flowcharts • Visuals'}
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
      ${m.id===state.model?'<span>âœ“</span>':''}
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
  state.currentChatId=crypto.randomUUID?crypto.randomUUID():String(Date.now());localStorage.setItem('nimbus_current_chat_id',String(state.currentChatId));
  state.chats.unshift({id:state.currentChatId,title:text.slice(0,42)+(text.length>42?'...':''),messages:[]});
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
  state.messages.push({role,text,fileName:fileName||null});persistCurrent();
  renderMessage(role,text,fileName,true,role==='ai');
  if(role!=='ai') persistCurrent();
}

function loadChat(id){
  const c=state.chats.find(x=>x.id===id);if(!c)return;
  state.currentChatId=id;localStorage.setItem('nimbus_current_chat_id',String(id));state.messages=c.messages||[];$('messages').innerHTML='';
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

function createVisualCard(meta={}){const d=document.createElement('div');d.className='message ai';const bubble=document.createElement('div');bubble.className='message-bubble ai-bubble visual-bubble';const title=escapeHtml(meta.title||'Study visual');const type=escapeHtml(meta.type||'diagram');const keywords=escapeHtml(meta.keywords||'keywords only');bubble.innerHTML=`<div class="visual-card-head"><div><span class="visual-kicker">FLUX • VISUAL</span><strong>${title}</strong><small>${type} • ${keywords}</small></div><span class="visual-badge">IMAGE</span></div><div class="visual-understanding-note">Visual generations are only for understanding.</div><div class="visual-loading" aria-live="polite"><span></span><span></span><span></span><div>Generating visual...</div></div>`;d.appendChild(bubble);$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight;return {d,bubble};}
function finishVisualCard(card,base64,mimeType,meta={}){if(!card?.bubble)return;const img=document.createElement('img');img.className='nimbus-visual-image';img.alt=`Nimbus ${meta.type||'diagram'}`;img.src=`data:${mimeType||'image/png'};base64,${base64}`;card.bubble.querySelector('.visual-loading')?.remove();card.bubble.appendChild(img);const note=document.createElement('div');note.className='visual-rephrase-note';note.textContent='Use the keywords and labels as study help, then rephrase the explanation in your own words.';card.bubble.appendChild(note);$('messages').scrollTop=$('messages').scrollHeight;}
function failVisualCard(card){if(!card?.bubble)return;const load=card.bubble.querySelector('.visual-loading');if(load){load.innerHTML='<div class="visual-fallback">Visual generation is unavailable right now.</div>';load.classList.add('visual-error');}}
function addVisualMessage(base64,mimeType,meta={}){const card=createVisualCard(meta);finishVisualCard(card,base64,mimeType,meta);}
function looksLikeSchoolWork(text){const s=String(text||'').toLowerCase();return /(homework|assignment|classwork|worksheet|study|studying|notes|revision|revise|exam|test|quiz|project|school|lesson|chapter|topic|explain|how does|why does|define|difference between|compare|biology|chemistry|physics|math|mathematics|history|geography|computer|programming|coding|python|javascript|html|css|lua|roblox|game|flowchart|diagram|concept map|process|steps)/i.test(s);}
function shouldAutoVisualizeClient(text){
  const s = String(text || '').trim();
  if (!s) return false;

  // Never auto-generate for casual chat.
  if (/^(?:hi|hello|hey|yo|sup|thanks|thank you|ok|okay|bye|good morning|good afternoon|good evening|good night|who are you|what is nimbus|what can you do)[!.?\s]*$/i.test(s)) {
    return false;
  }

  // Never auto-generate for Beaconhouse information questions.
  if (/\b(?:beaconhouse|bisc|beams|prism|rise|lap|boss|book\s*list|booklist|campus|admissions?|competition)\b/i.test(s)) {
    return false;
  }

  const academicSubject = /\b(?:biology|chemistry|physics|science|respiration|breathing|lungs?|heart|circulation|digestion|enzyme(?:s)?|photosynthesis|diaphragm|muscle(?:s)?|joint(?:s)?|skeleton|cell(?:s)?|tissue(?:s)?|ecosystem(?:s)?|food\s+chain|food\s+web|diffusion|aerobic|anaerobic|electricity|circuit(?:s)?|force(?:s)?|energy|heat|temperature|density|pressure|friction|gravity|atom(?:s)?|molecule(?:s)?|matter|reaction(?:s)?|algebra|equation(?:s)?|fraction(?:s)?|geometry|ratio|percentage|probability|statistics|history|geography|civilization|empire|timeline|map(?:s)?|coding|programming|algorithm(?:s)?|computer\s+science|ict|class\s*\d+|grade\s*\d+|homework|schoolwork|lesson|chapter)\b/i.test(s);

  const learningIntent = /\b(?:what\s+is|what\s+are|what\s+does|what\s+do|explain|describe|define|how\s+does|how\s+do|why\s+does|why\s+do|difference\s+between|compare|function\s+of|purpose\s+of|types?\s+of|process|steps?|sequence|solve|calculate|show|diagram|visuali[sz]e|illustrate|illustration|flowchart|picture|image|chart)\b/i.test(s);

  return academicSubject && learningIntent;
}
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
  const explicitVisualRequest=/(?:^|\s)\/visual(?:\s|$)/i.test(String(text||''));
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
    if(state.model==='nano-banana-2' && explicitVisualRequest){
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
    if(explicitVisualRequest && data.visual?.prompt){
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
$('visualBtn').onclick=async()=>{
  const topic=$('messageInput').value.trim();

  if(!topic){
    $('messageInput').focus();
    return;
  }

  if(state.used>=USAGE_LIMIT){
    add('ai',`Daily limit reached. Your 24-hour window resets in ${usageTimeLeft()}.`);
    return;
  }

  ensureChat(topic);
  add('user',topic);

  $('messageInput').value='';
  $('messageInput').style.height='auto';
  setAgentThinking(true);

  try{
    await generateVisual(
      `Create a clean, topic-specific educational visual for this student learning request.
Topic: ${topic}
Use accurate subject imagery, anatomy, objects, process stages, diagrams, spatial relationships, arrows and visual distinctions where useful.
Do NOT generate readable text, words, letters, numbers, labels, captions, typography, logos, watermarks, pseudo-writing, fake handwriting, or text panels.
The artwork itself must communicate the concept visually.`,
      {
        title:topic,
        type:'educational visual',
        keywords:'concept • relationships • process'
      }
    );

    consumeLocalUsage();
  } finally {
    setAgentThinking(false);
  }
};
$('fileInput').onchange=()=>{const f=$('fileInput').files[0];if(!f)return;state.file=f;$('attachment').classList.remove('hidden');$('attachment').innerHTML=`📎 <b>${escapeHtml(f.name)}</b> · ${(f.size/1024).toFixed(1)} KB <button id="removeAttachment" style="float:right;border:0;background:none">x</button>`;$('removeAttachment').onclick=()=>{$('fileInput').value='';state.file=null;$('attachment').classList.add('hidden')}};

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
$('ownerLogin').onclick=async()=>{const email=$('ownerEmail').value.trim();if(!email){$('ownerMsg').textContent='Enter an owner email.';return}$('ownerMsg').textContent='Checking...';try{const r=await fetch('/api/admin-authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();if(!r.ok||!d.ok){$('ownerMsg').textContent=d.message||'Owner access denied.';return}$('ownerDashboard').classList.remove('hidden');$('ownerMsg').textContent='Owner email authorized.';$('ownerDashboard').innerHTML=`<div class="stats"><div class="stat"><span>MONTHLY REVENUE</span><b>$${Number(d.metrics.monthly_revenue||0).toLocaleString()}</b></div><div class="stat"><span>MESSAGES TODAY</span><b>${Number(d.metrics.messages_today||0).toLocaleString()}</b></div><div class="stat"><span>DAILY LIMIT / USER</span><b>${Number(d.metrics.daily_limit||1500).toLocaleString()}</b></div><div class="stat"><span>ACTIVE MODELS</span><b>${Number(d.metrics.active_models||2)}</b></div></div><div class="admin-section"><h3>Owner account</h3><p>${escapeHtml(d.email)} is on the server-side owner allowlist.</p></div>`}catch{$('ownerMsg').textContent='Server unavailable.'}};

function init(){syncAccount();renderHistory();renderModels();if(state.id){$('loginModal').classList.add('hidden');$('app').classList.remove('hidden');if(state.chats.length)loadChat(state.chats[0].id)}}
init();


// Public Premium Models - Nimbus 5.7 Lor via Puter.js
const PREMIUM_PUBLIC_LABEL='Nimbus 5.7 Lor';
const PREMIUM_PUBLIC_MODEL='gpt-6-astra';
let premiumReady=false;
async function openPremium(){
  $('premiumModal').classList.remove('hidden');
  $('premiumStatus').textContent='Checking availability...';
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
          'white-space:nowrap;">XHigh â–¾</button>' +

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
          speedBtn.textContent = speedLabel() + " â–¾";
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

/* NIMTRON SIDEBAR LINK V1 */
(function(){
  function installNimTronSidebarLink(){
    var newChat=document.getElementById("newChat");
    if(!newChat || document.getElementById("nimtronSidebarBtn")) return;

    var style=document.createElement("style");
    style.id="nimtron-sidebar-style";
    style.textContent=
      "#nimtronSidebarBtn{margin-top:7px;border:1px solid rgba(65,223,255,.34);background:linear-gradient(135deg,rgba(65,223,255,.12),rgba(65,223,255,.03));color:#41dfff}" +
      "#nimtronSidebarBtn:hover{border-color:rgba(65,223,255,.72);box-shadow:0 0 18px rgba(65,223,255,.10)}";
    document.head.appendChild(style);

    var btn=document.createElement("button");
    btn.type="button";
    btn.id="nimtronSidebarBtn";
    btn.className=newChat.className;
    btn.title="Open NimTron Desktop Companion";
    btn.innerHTML="<span>◈</span> NimTron";
    btn.addEventListener("click",function(){
      window.location.href="/nimtron.html";
    });

    newChat.insertAdjacentElement("afterend",btn);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",installNimTronSidebarLink,{once:true});
  }else{
    installNimTronSidebarLink();
  }
})();


/* NIMBUS_V9_VISUAL_COMMAND_BUTTON */
(function(){
  function installNimbusVisualCommandButton(){
    var button=document.getElementById('visualBtn');
    var input=document.getElementById('messageInput');
    if(!button||!input)return;

    button.onclick=function(event){
      if(event){event.preventDefault();event.stopImmediatePropagation();}
      var value=String(input.value||'').trim();
      if(!value){input.focus();return;}
      value=value.replace(/(?:^|\s)\/visual(?:\s|$)/ig,' ').replace(/\s+/g,' ').trim();
      input.value=value ? value+' /visual' : '/visual';
      input.focus();
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installNimbusVisualCommandButton,{once:true});
  }else{
    installNimbusVisualCommandButton();
  }
})();


/* NIMBUS_V9_REFRESH_RESTORE */
(function(){
  function restoreNimbusProgress(){
    try{
      if(typeof state==='undefined'||state.currentChatId)return;
      if(!Array.isArray(state.chats)||!state.chats.length)return;
      if(typeof loadChat!=='function')return;

      var savedId=localStorage.getItem('nimbus_current_chat_id');
      var target=state.chats.find(function(chat){
        return chat&&chat.id===savedId;
      })||state.chats[0];

      if(target&&target.id)loadChat(target.id);
    }catch(error){
      console.warn('Nimbus saved chat restore failed',error);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',restoreNimbusProgress,{once:true});
  }else{
    setTimeout(restoreNimbusProgress,0);
  }
})();


/* NIMBUS_V15_MOTION_SPEED_SELECTOR */
(function(){
  function installNimbusMotionSpeed(){
    if(window.__NIMBUS_V15_SPEED__)return;
    if(typeof state==='undefined')return;

    var composer=document.getElementById('composer');
    var send=document.getElementById('sendBtn');
    if(!composer||!send)return;

    window.__NIMBUS_V15_SPEED__=true;

    var speeds=[
      {id:'xhigh',label:'XHigh',sub:'Normal • 1 RPD'},
      {id:'rapid',label:'Rapid',sub:'Faster • 2 RPD'},
      {id:'max',label:'Super Rapid',sub:'Fastest • 3 RPD'}
    ];

    var saved=String(localStorage.getItem('nimbus_speed_mode')||state.speedMode||'xhigh').toLowerCase();
    if(!speeds.some(function(item){return item.id===saved;}))saved='xhigh';
    state.speedMode=saved;

    var style=document.createElement('style');
    style.id='nimbus-v15-speed-style';
    style.textContent=
      '#nimbusMotionSpeedWrap{position:relative;display:flex;align-items:center;flex:0 0 auto}' +
      '#nimbusMotionSpeedBtn{height:40px;padding:0 12px;border:1px solid rgba(99,102,241,.34);border-radius:13px;background:rgba(99,102,241,.07);color:inherit;display:flex;align-items:center;gap:6px;font:600 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}' +
      '#nimbusMotionSpeedBtn:hover{border-color:rgba(99,102,241,.65);box-shadow:0 5px 18px rgba(99,102,241,.10);transform:translateY(-1px)}' +
      '#nimbusMotionSpeedBtn .nimbus-speed-chevron{font-size:10px;opacity:.55;transition:transform .2s ease}' +
      '#nimbusMotionSpeedWrap.open #nimbusMotionSpeedBtn .nimbus-speed-chevron{transform:rotate(180deg)}' +
      '#nimbusMotionSpeedMenu{position:absolute;right:0;bottom:52px;width:286px;padding:13px;border:1px solid rgba(15,23,42,.12);border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 18px 55px rgba(15,23,42,.18);backdrop-filter:blur(18px);z-index:80;opacity:0;visibility:hidden;transform:translateY(8px) scale(.985);transform-origin:bottom right;transition:opacity .18s ease,transform .18s ease,visibility .18s ease}' +
      '#nimbusMotionSpeedWrap.open #nimbusMotionSpeedMenu{opacity:1;visibility:visible;transform:translateY(0) scale(1)}' +
      '.nimbus-speed-title{font:650 12px/1.2 system-ui,-apple-system,sans-serif;margin:1px 2px 10px;color:#111827}' +
      '.nimbus-speed-track{position:relative;display:grid;grid-template-columns:repeat(3,1fr);padding:3px;border-radius:14px;background:#eef0f5;overflow:hidden}' +
      '.nimbus-speed-thumb{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/3);border-radius:11px;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.12);transition:transform .28s cubic-bezier(.2,.8,.2,1)}' +
      '.nimbus-speed-slot{position:relative;z-index:2;border:0;background:transparent;padding:9px 5px;border-radius:11px;color:#6b7280;font:650 11px/1 system-ui,-apple-system,sans-serif;cursor:pointer;transition:color .18s ease}' +
      '.nimbus-speed-slot.active{color:#111827}' +
      '.nimbus-speed-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:11px 3px 1px}' +
      '.nimbus-speed-meta strong{font:650 13px/1.2 system-ui,-apple-system,sans-serif;color:#111827}' +
      '.nimbus-speed-meta span{font:500 11px/1.2 system-ui,-apple-system,sans-serif;color:#6b7280}' +
      '.nimbus-speed-motion{height:3px;flex:1;max-width:80px;border-radius:999px;background:#e5e7eb;overflow:hidden;position:relative}' +
      '.nimbus-speed-motion::after{content:"";position:absolute;inset:0;width:40%;border-radius:inherit;background:linear-gradient(90deg,transparent,#6366f1,transparent);animation:nimbusSpeedSweep 1.8s ease-in-out infinite}' +
      '@keyframes nimbusSpeedSweep{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}' +
      '@media(prefers-color-scheme:dark){#nimbusMotionSpeedMenu{background:rgba(24,24,27,.96);border-color:rgba(255,255,255,.10)}.nimbus-speed-title,.nimbus-speed-meta strong{color:#f4f4f5}.nimbus-speed-track{background:#27272a}.nimbus-speed-thumb{background:#3f3f46;box-shadow:0 2px 10px rgba(0,0,0,.3)}.nimbus-speed-slot.active{color:#fff}.nimbus-speed-slot,.nimbus-speed-meta span{color:#a1a1aa}.nimbus-speed-motion{background:#3f3f46}}' +
      '@media(prefers-reduced-motion:reduce){.nimbus-speed-thumb,#nimbusMotionSpeedMenu,#nimbusMotionSpeedBtn{transition:none}.nimbus-speed-motion::after{animation:none;display:none}}';
    document.head.appendChild(style);

    var wrap=document.createElement('div');
    wrap.id='nimbusMotionSpeedWrap';
    wrap.innerHTML=
      '<button type="button" id="nimbusMotionSpeedBtn" aria-haspopup="true" aria-expanded="false">' +
        '<span id="nimbusMotionSpeedLabel">XHigh</span><span class="nimbus-speed-chevron">⌃</span>' +
      '</button>' +
      '<div id="nimbusMotionSpeedMenu" role="menu" aria-label="Nimbus response speed">' +
        '<div class="nimbus-speed-title">Response speed</div>' +
        '<div class="nimbus-speed-track">' +
          '<div class="nimbus-speed-thumb"></div>' +
          '<button type="button" class="nimbus-speed-slot" data-v15-speed="xhigh">XHigh</button>' +
          '<button type="button" class="nimbus-speed-slot" data-v15-speed="rapid">Rapid</button>' +
          '<button type="button" class="nimbus-speed-slot" data-v15-speed="max">Super</button>' +
        '</div>' +
        '<div class="nimbus-speed-meta">' +
          '<div><strong id="nimbusMotionSpeedName">XHigh</strong><br><span id="nimbusMotionSpeedSub">Normal • 1 RPD</span></div>' +
          '<div class="nimbus-speed-motion" aria-hidden="true"></div>' +
        '</div>' +
      '</div>';

    composer.insertBefore(wrap,send);

    // Hide only known older public speed controls; memory remains untouched.
    var oldSpeed=document.getElementById('nimbusSpeedBtnClean');
    if(oldSpeed)oldSpeed.style.display='none';

    document.querySelectorAll(
      '.nimbus-speed-v7,.nimbus-speed-v9,.nimbus-speed-v10,[data-clean-speed]'
    ).forEach(function(el){el.style.display='none';});

    var button=document.getElementById('nimbusMotionSpeedBtn');
    var menu=document.getElementById('nimbusMotionSpeedMenu');
    var thumb=menu.querySelector('.nimbus-speed-thumb');
    var label=document.getElementById('nimbusMotionSpeedLabel');
    var name=document.getElementById('nimbusMotionSpeedName');
    var sub=document.getElementById('nimbusMotionSpeedSub');

    function sync(mode){
      var index=speeds.findIndex(function(item){return item.id===mode;});
      if(index<0)index=0;
      var item=speeds[index];

      state.speedMode=item.id;
      localStorage.setItem('nimbus_speed_mode',item.id);

      label.textContent=item.label;
      name.textContent=item.label;
      sub.textContent=item.sub;
      thumb.style.transform='translateX('+(index*100)+'%)';

      menu.querySelectorAll('[data-v15-speed]').forEach(function(slot){
        slot.classList.toggle('active',slot.dataset.v15Speed===item.id);
      });
    }

    function setOpen(open){
      wrap.classList.toggle('open',open);
      button.setAttribute('aria-expanded',open?'true':'false');
    }

    button.addEventListener('click',function(event){
      event.preventDefault();
      event.stopPropagation();
      setOpen(!wrap.classList.contains('open'));
    });

    menu.querySelectorAll('[data-v15-speed]').forEach(function(slot){
      slot.addEventListener('click',function(event){
        event.preventDefault();
        event.stopPropagation();
        sync(slot.dataset.v15Speed);
        setOpen(false);
      });
    });

    document.addEventListener('click',function(event){
      if(!wrap.contains(event.target))setOpen(false);
    });

    sync(saved);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installNimbusMotionSpeed,{once:true});
  }else{
    installNimbusMotionSpeed();
  }
})();


/* NIMBUS_V16_COMPOSER_FINALIZER */
(function(){
  function installNimbusComposerFinalizer(){
    if(window.__NIMBUS_V16_COMPOSER_FINALIZER__)return;
    window.__NIMBUS_V16_COMPOSER_FINALIZER__=true;

    var composer=document.getElementById('composer');
    var visualButton=document.getElementById('visualBtn');
    var input=document.getElementById('messageInput');

    if(!composer)return;

    function removeOldSpeedControls(){
      var newSpeed=document.getElementById('nimbusMotionSpeedWrap');

      [
        '#nimbusSpeedBtnClean',
        '#nimbusSpeedBtn',
        '#nimbusSpeedSelector',
        '#nimbusSpeedDropdown',
        '.nimbus-speed-v7',
        '.nimbus-speed-v9',
        '.nimbus-speed-v10',
        '[data-clean-speed]',
        '[data-nimbus-speed-v7]',
        '[data-nimbus-speed-v9]',
        '[data-nimbus-speed-v10]'
      ].forEach(function(selector){
        document.querySelectorAll(selector).forEach(function(el){
          if(!newSpeed || !newSpeed.contains(el)){
            el.remove();
          }
        });
      });

      // Remove any leftover legacy speed button sitting directly inside
      // the composer, while preserving the new animated V15 selector.
      Array.from(composer.querySelectorAll('button')).forEach(function(button){
        if(newSpeed && newSpeed.contains(button))return;
        if(button.id==='sendBtn'||button.id==='attachBtn'||button.id==='visualBtn')return;

        var text=String(button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        var title=String(button.getAttribute('title')||'').toLowerCase();
        var aria=String(button.getAttribute('aria-label')||'').toLowerCase();

        var looksLikeLegacySpeed =
          /^(xhigh|rapid|super rapid|max)(\s*[⌃⌄▲▼^v]?)?$/i.test(text) ||
          title.includes('speed') ||
          aria.includes('speed');

        if(looksLikeLegacySpeed){
          button.remove();
        }
      });

      // Remove empty legacy wrappers left behind after deleting speed buttons.
      [
        '#nimbusCleanControls',
        '#nimbusComposerModesV7',
        '#nimbusComposerModesV9',
        '#nimbusComposerModesV10'
      ].forEach(function(selector){
        var el=document.querySelector(selector);
        if(!el)return;

        var hasUsefulControl=
          el.querySelector('#nimbusCleanMemory') ||
          el.querySelector('[id*="Memory"]') ||
          el.querySelector('button:not([style*="display: none"])');

        if(!hasUsefulControl){
          el.remove();
        }
      });
    }

    function installVisualButton(){
      visualButton=document.getElementById('visualBtn');
      input=document.getElementById('messageInput');
      if(!visualButton||!input)return;

      function insertVisualCommand(event){
        if(event){
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }

        var value=String(input.value||'')
          .replace(/(?:^|\s)\/visual(?:\s|$)/ig,' ')
          .replace(/\s+/g,' ')
          .trim();

        input.value=value ? value+' /visual' : '/visual';

        try{
          input.dispatchEvent(new Event('input',{bubbles:true}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }catch(_){}

        input.focus();
        try{
          input.setSelectionRange(input.value.length,input.value.length);
        }catch(_){}
      }

      // Capture phase makes this reliable even if an older onclick handler
      // was installed elsewhere later in app.js.
      visualButton.addEventListener('click',insertVisualCommand,true);
      visualButton.addEventListener('pointerup',function(event){
        if(event.pointerType==='touch'){
          insertVisualCommand(event);
        }
      },true);

      visualButton.setAttribute('title','Add /visual to this message');
      visualButton.setAttribute('aria-label','Add /visual to this message');
    }

    removeOldSpeedControls();
    installVisualButton();

    // Older UI patches may mount after DOMContentLoaded. Watch briefly and
    // remove only legacy speed controls if they reappear.
    var observer=new MutationObserver(function(){
      removeOldSpeedControls();
    });

    observer.observe(composer,{childList:true,subtree:true});

    setTimeout(function(){
      removeOldSpeedControls();
      observer.disconnect();
    },4000);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installNimbusComposerFinalizer,{once:true});
  }else{
    installNimbusComposerFinalizer();
  }
})();


/* NIMBUS_V18_1_HOME_ACTIONS */
(function(){
  function installNimbusHomeActions(){
    if(window.__NIMBUS_V18_1_HOME_ACTIONS__)return;
    window.__NIMBUS_V18_1_HOME_ACTIONS__=true;

    var input=document.getElementById('messageInput');
    var composer=document.getElementById('composer');
    var fileInput=document.getElementById('fileInput');
    var newChat=document.getElementById('newChat');
    var clearChat=document.getElementById('clearChat');

    if(!input||!composer||!fileInput)return;

    // Only formats the file types the current chat backend actually sends
    // inline to the model.
    fileInput.setAttribute('accept','.pdf,.txt,.png,.jpg,.jpeg,.webp');

    state.nimbusTaskMode='';

    function setInput(value){
      input.value=value;
      try{input.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){}
      input.focus();
      try{input.setSelectionRange(input.value.length,input.value.length);}catch(_){}
    }

    function identifyHomeCards(){
      document.querySelectorAll('[data-prompt]').forEach(function(button){
        var label=String(
          (button.querySelector('b')&&button.querySelector('b').textContent) ||
          button.textContent ||
          ''
        ).replace(/\s+/g,' ').trim().toLowerCase();

        if(label.includes('explain a topic'))button.dataset.nimbusAction='explain-topic';
        else if(label.includes('build a study plan'))button.dataset.nimbusAction='study-plan';
        else if(label.includes('start a quiz'))button.dataset.nimbusAction='start-quiz';
        else if(label.includes('study a file'))button.dataset.nimbusAction='study-file';
      });
    }

    identifyHomeCards();

    document.addEventListener('click',function(event){
      var button=event.target&&event.target.closest
        ? event.target.closest('[data-nimbus-action]')
        : null;

      if(!button)return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      var action=button.dataset.nimbusAction||'';

      if(action==='explain-topic'){
        state.nimbusTaskMode='';
        setInput('Explain ');
        return;
      }

      if(action==='study-plan'){
        state.nimbusTaskMode='study_plan';
        setInput('Build me a practical study plan. First ask for my subjects, exam date, available study time, weak areas, and priorities.');
        composer.requestSubmit();
        return;
      }

      if(action==='start-quiz'){
        state.nimbusTaskMode='quiz';
        setInput('Start a quiz. First ask which subject or topic and difficulty I want. Then ask one question at a time and wait for my answer.');
        composer.requestSubmit();
        return;
      }

      if(action==='study-file'){
        state.nimbusTaskMode='study_file';
        fileInput.click();
      }
    },true);

    // The existing fileInput.onchange stores the selected File in state.file.
    // This listener runs after selection and submits once that handler finishes.
    fileInput.addEventListener('change',function(){
      if(state.nimbusTaskMode!=='study_file')return;
      if(!fileInput.files||!fileInput.files[0])return;

      setInput('Study this file. Summarize the key ideas, identify important terms, explain what I should revise, and highlight likely exam-focus areas.');

      setTimeout(function(){
        composer.requestSubmit();
      },0);
    });

    // New chat exits plan/quiz modes.
    [newChat,clearChat].forEach(function(button){
      if(!button)return;
      button.addEventListener('click',function(){
        state.nimbusTaskMode='';
      },true);
    });

    // Add task_mode to the existing request without rewriting sendMessage,
    // saved chats, memory, speed, or visual wrappers.
    if(!window.__NIMBUS_V18_1_TASK_FETCH__){
      window.__NIMBUS_V18_1_TASK_FETCH__=true;
      var previousFetch=window.fetch.bind(window);

      window.fetch=async function(inputArg,init){
        var url=typeof inputArg==='string' ? inputArg : ((inputArg&&inputArg.url)||'');
        var method=String((init&&init.method)||'GET').toUpperCase();
        var mode=String(state.nimbusTaskMode||'');

        if(method==='POST' && /\/api\/chat(?:\?|$)/i.test(url) && init && typeof init.body==='string'){
          try{
            var payload=JSON.parse(init.body);
            var message=String(payload.message||'');

            // Allow the student to leave an interactive mode naturally.
            if(/\b(?:stop|end|exit|cancel)\s+(?:the\s+)?(?:quiz|study\s+plan|plan)\b/i.test(message)){
              mode='';
              state.nimbusTaskMode='';
            }

            payload.task_mode=mode;
            init=Object.assign({},init,{body:JSON.stringify(payload)});
          }catch(_){}
        }

        try{
          return await previousFetch(inputArg,init);
        }finally{
          // File study is one request. Quiz/study-plan remain active for
          // follow-up answers until New Chat or an explicit stop command.
          if(method==='POST' && /\/api\/chat(?:\?|$)/i.test(url) && mode==='study_file'){
            state.nimbusTaskMode='';
          }
        }
      };
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',installNimbusHomeActions,{once:true});
  }else{
    installNimbusHomeActions();
  }
})();


/* NIMBUS_V18_1_REMOVE_LEGACY_SPEED */
(function(){
  function removeLegacyNimbusSpeed(){
    var composer=document.getElementById('composer');
    var newSpeed=document.getElementById('nimbusMotionSpeedWrap');
    if(!composer||!newSpeed)return;

    var keepIds=new Set(['sendBtn','attachBtn','visualBtn','nimbusMotionSpeedBtn']);

    composer.querySelectorAll('button').forEach(function(button){
      if(newSpeed.contains(button))return;
      if(keepIds.has(button.id))return;

      var text=String(button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      var id=String(button.id||'').toLowerCase();
      var cls=String(button.className||'').toLowerCase();
      var title=String(button.getAttribute('title')||'').toLowerCase();
      var aria=String(button.getAttribute('aria-label')||'').toLowerCase();

      var oldSpeed =
        /\b(xhigh|rapid|super rapid|max)\b/i.test(text) ||
        id.includes('speed') ||
        cls.includes('speed') ||
        title.includes('speed') ||
        aria.includes('speed') ||
        button.hasAttribute('data-clean-speed') ||
        button.hasAttribute('data-nimbus-speed') ||
        button.hasAttribute('data-nimbus-speed-v7') ||
        button.hasAttribute('data-nimbus-speed-v9') ||
        button.hasAttribute('data-nimbus-speed-v10');

      if(oldSpeed)button.remove();
    });
  }

  function run(){
    removeLegacyNimbusSpeed();

    var composer=document.getElementById('composer');
    if(!composer)return;

    var observer=new MutationObserver(removeLegacyNimbusSpeed);
    observer.observe(composer,{childList:true,subtree:true});

    setTimeout(removeLegacyNimbusSpeed,250);
    setTimeout(removeLegacyNimbusSpeed,900);
    setTimeout(removeLegacyNimbusSpeed,2200);
    setTimeout(function(){
      removeLegacyNimbusSpeed();
      observer.disconnect();
    },6000);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',run,{once:true});
  }else{
    run();
  }
})();
