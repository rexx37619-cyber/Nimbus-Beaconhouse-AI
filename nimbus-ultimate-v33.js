/* Nimbus Ultimate V33 — learning sessions isolated from normal Nimbus chats. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('nimbusLearningPanel'),open=$('nimbusLearningOpen');
 if(!panel||!open)return;
 const modes={
  hint_ladder:{name:'Hint Mode',desc:'Build your answer through three increasingly useful hints.',btn:'Generate hints'},
  answer_coach:{name:'Answer Coach',desc:'Get focused feedback on an answer you wrote yourself.',btn:'Review my answer'},
  find_mistake:{name:'Find the Mistake',desc:'Investigate one mistake and explain your reasoning.',btn:'Start challenge'},
  creative_writing:{name:'Creative Writing',desc:'Plan, write and improve your own original ideas.',btn:'Plan my writing'}
 };
 const thread=$('nuMessages'),scroller=$('nuConversation'),intro=$('nuIntro'),q=$('nuQuestion'),draft=$('nuDraft'),draftWrap=$('nuDraftWrap');
 const status=$('nuStatus'),send=$('nuSubmit'),visual=$('nuVisual');
 let mode='',working=false,challenge='',hints=[],hintIndex=0,lastTopic='',controller=null;
 const storageKey=()=>`nimbus_learning_v34_${String((typeof state!=='undefined'?state.id:'')||'guest').slice(0,80).toLowerCase()}`;
 const readSessions=()=>{try{const data=JSON.parse(localStorage.getItem(storageKey())||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}};
 const saveSessions=data=>{try{localStorage.setItem(storageKey(),JSON.stringify(data))}catch{}};
 const keyNames={title:'Topic',strength:'What you did well',improve:'What to improve',nextQuestion:'Think about this',feedback:'Your reasoning',correction:'Correct fact',challenge:'Find the mistake',prompt:'Your task',setting:'Writing angle',conflict:'Central theme',vocabulary:'Useful vocabulary',writingTip:'Writing tip',refusal:'Nimbus'};
 function make(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
 function setStatus(s,err=false){status.textContent=s;status.dataset.error=String(err)}
 function scroll(){scroller.scrollTop=scroller.scrollHeight}
 function addUser(message,persist=true){intro.hidden=true;const line=make('div','nu-bubble',message);line.dataset.role='user';thread.append(line);scroll();if(persist)saveRecord({role:'user',text:message})}
 function showField(parent,k,value){if(value===undefined||value===null||value==='')return;const card=make('div','nu-ai-field');card.append(make('strong','',keyNames[k]||k));card.append(make('p','',Array.isArray(value)?value.join(' · '):value));parent.append(card)}
 function showResult(result,save=true){intro.hidden=true;const bubble=make('div','nu-bubble');bubble.dataset.role='ai';const h=make('div','nu-ai-head');h.append(make('span','','Nimbus • '+(modes[mode]?.name||'Learning')));bubble.append(h);
  if(result.refusal){showField(bubble,'refusal',result.refusal)}
  else if(mode==='hint_ladder'&&Array.isArray(result.hints)){
    hints=result.hints.slice(0,3);hintIndex=0;
    if(result.title)showField(bubble,'title',result.title);
    const hintCard=make('div','nu-ai-field');const title=make('strong','nu-hint-title','HINT 1 / 3');const text=make('p','nu-hint-text',hints[0]);hintCard.append(title,text);bubble.append(hintCard);
    const button=make('button','nu-chip','Unlock next hint →');button.type='button';
    button.addEventListener('click',()=>{if(hintIndex>=2)return;hintIndex++;title.textContent=`HINT ${hintIndex+1} / 3`;text.textContent=hints[hintIndex];if(hintIndex===2)button.disabled=true});bubble.append(button);
    if(result.nextQuestion)showField(bubble,'nextQuestion',result.nextQuestion)
  }else{
    for(const [k,v] of Object.entries(result)){if(k==='hints')continue;showField(bubble,k,v)}
  }
  thread.append(bubble);scroll();if(save){saveRecord({role:'ai',result,mode});}
 }
 function saveRecord(record){if(!mode)return;const sessions=readSessions();const list=Array.isArray(sessions[mode])?sessions[mode]:[];list.push(record);sessions[mode]=list.slice(-32);saveSessions(sessions)}
 function renderModeHistory(){thread.replaceChildren();intro.hidden=false;const list=readSessions()[mode]||[];for(const item of list){if(item.role==='user')addUser(item.text,false);else if(item.role==='ai')showResult(item.result||{},false)}scroll()}
 function busy(on){
  working=on;send.disabled=on||!mode;visual.disabled=on||!mode;q.disabled=on||!mode;draft.disabled=on;
  send.textContent=on?'Nimbus is thinking…':buttonLabel();
  let loader=thread.querySelector('.nu-mode-thinking');
  if(on){
    if(!loader){
      loader=make('div','nu-mode-thinking');loader.setAttribute('role','status');
      loader.setAttribute('aria-label','Nimbus is thinking');
      const pic=make('img','nu-mode-thinking-brain');pic.src='/assets/nimbus-v3461-brain.webp';pic.alt='';pic.setAttribute('aria-hidden','true');
      const dots=make('span','nu-mode-thinking-dots');dots.setAttribute('aria-hidden','true');
      for(let i=0;i<3;i++)dots.append(make('i'));
      loader.append(pic,dots);thread.append(loader);
    }
    scroll();
  }else if(loader){loader.remove();}
 }
 function buttonLabel(){if(!mode)return'Select a mode first';if(mode==='find_mistake'&&challenge)return'Check my reasoning ↑';if(mode==='creative_writing')return'Get writing ideas ↑';return modes[mode].btn+' ↑'}
 function choose(next){if(!modes[next])return;controller?.abort();controller=null;mode=next;challenge='';hints=[];hintIndex=0;q.value='';draft.value='';
  panel.querySelectorAll('[data-nu-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.nuMode===mode)));
  $('nuModeTitle').textContent=modes[mode].name;$('nuModeDesc').textContent=modes[mode].desc;
  $('nuDraftWrap').hidden=!['answer_coach','creative_writing'].includes(mode);
  $('nuDraftWrap').querySelector('label').textContent=mode==='answer_coach'?'Your answer (required)':'Your title (optional)';
  draft.placeholder=mode==='creative_writing'?'Your own title (e.g. The Midnight Library)…':'Write your answer in your own words…';
  q.placeholder=mode==='creative_writing'?'Choose a format: story, report, newspaper article, essay…':'Ask a question or name a topic…';
  busy(false);setStatus('Follow this mode to think independently.');renderModeHistory();q.focus();}
 panel.querySelectorAll('[data-nu-mode]').forEach(el=>el.addEventListener('click',()=>choose(el.dataset.nuMode)));
 function show(){panel.hidden=false;$('app')?.classList.add('nu-workspace-active');open.setAttribute('aria-expanded','true');$('sidebar')?.classList.remove('open');setStatus(mode?'Continue your learning session.':'Choose a learning mode to begin.');if(mode)renderModeHistory();}
 function hide(){controller?.abort();controller=null;busy(false);panel.hidden=true;$('app')?.classList.remove('nu-workspace-active');open.setAttribute('aria-expanded','false');}
 open.addEventListener('click',show);$('nlClose')?.addEventListener('click',hide);$('nuBack')?.addEventListener('click',hide);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
 ['newChat','clearChat','clearAll','premiumModelsBtn'].forEach(id=>$(id)?.addEventListener('click',hide));
 $('chatHistory')?.addEventListener('click',e=>{if(e.target.closest('.history-item'))hide()});
 $('nuClearHistory')?.addEventListener('click',()=>{if(!mode||!window.confirm('Clear this learning mode’s history?'))return;const data=readSessions();delete data[mode];saveSessions(data);challenge='';renderModeHistory();setStatus('Learning history cleared.')});
 draft.addEventListener('input',()=>{if(!working)send.textContent=buttonLabel()});
 const errorLabel=(code,http,prov)=>({GEMINI_KEY_MISSING:'Gemini credentials are missing in this environment.',GEMINI_BUSY:'Gemini is busy or rate-limited. Please try later.',LEARNING_TIMEOUT:'Gemini took too long. Try a shorter question.',LEARNING_RATE_LIMIT:'Too many learning requests. Try again later.',INVALID_MODEL_RESPONSE:'Gemini gave an incomplete reply. Please retry.',LEARNING_ALL_MODELS_UNAVAILABLE:'All configured Gemini models failed. See Vercel logs.',GEMINI_CONFIGURATION_ERROR:'Gemini access or request configuration was rejected.',INVALID_MODE_ACTION:'Choose a valid learning mode.',NIMBUS_SIGN_IN_REQUIRED:'Sign in to Nimbus first.',NIMBUS_DAILY_LIMIT_REACHED:'Your daily allowance is used. Try again after the UTC reset.'}[code]||((http===404)?'Learning API not deployed at /api/learning-v31.':'Learning guidance unavailable'+(prov?' (provider HTTP '+prov+')':'')+'.'));
 async function submit(e){e.preventDefault();if(!mode||working)return;const question=q.value.trim(),answer=draft.value.trim();if(!question){q.focus();setStatus('Enter your topic or question.',true);return}
  if(mode==='answer_coach'&&!answer){draft.focus();setStatus('Write your answer first for Answer Coach.',true);return}
  if(mode==='find_mistake'&&challenge&&!answer){draft.focus();setStatus('Explain the mistake you identified first.',true);return}
  const action=mode==='find_mistake'?(challenge?'check':'start'):mode==='answer_coach'?'review':'start';
  const request={mode,action,question,draft:answer,challenge,speed_mode:'xhigh',client_request_id:crypto.randomUUID()};lastTopic=question;addUser(question+(answer?'\n\nMy attempt: '+answer:''));
  controller=new AbortController();busy(true);setStatus('Nimbus is preparing guided feedback…');
  try{
   const response=await fetch('/api/learning-v31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal});
   let data={};try{data=await response.json()}catch{}
   if(response.headers.get('X-Nimbus-Used'))updateUsage(Number(response.headers.get('X-Nimbus-Used')));
   if(!response.ok||!data.ok)throw Object.assign(Error('Learning request failed'),{http:response.status,code:data.error_code,provider_status:data.provider_status});
   if(mode==='find_mistake'&&action==='start'){challenge=data.result.challenge||'';draftWrap.hidden=false;draftWrap.querySelector('label').textContent='Which part is wrong? Explain your reasoning.';draft.value='';}
   if(mode==='find_mistake'&&action==='check'){challenge='';draft.value='';draftWrap.hidden=true;}
   showResult(data.result||{});window.nimbusRefreshQuota?.().catch(()=>{});setStatus('Guidance ready. Keep exploring.');
  }catch(err){if(err?.name!=='AbortError')setStatus(errorLabel(err.code,err.http,err.provider_status),true)}finally{controller=null;busy(false)}
 }
 $('nuForm')?.addEventListener('submit',submit);
 visual?.addEventListener('click',async()=>{if(!mode||working)return;const topic=q.value.trim()||lastTopic;if(!topic){setStatus('Enter a topic before requesting a visual.',true);return}
  if(!window.confirm('Generate one educational visual using Cloudflare Workers AI credits?'))return;
  controller=new AbortController();busy(true);setStatus('Generating your learning visual…');
  try{
   const r=await fetch('/api/visual-pollinations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:topic+' — educational illustration relevant to '+modes[mode].name}),signal:controller.signal});const d=await r.json();
   if(!r.ok||!d.ok||!d.data||!/^image\/(png|jpeg|webp)$/.test(d.mimeType))throw Object.assign(Error('Visual error'),{code:d.error_code,http:r.status,provider_status:d.provider_status});
   intro.hidden=true;const node=make('div','nu-bubble');node.dataset.role='ai';const img=document.createElement('img');img.className='nu-image';img.src='data:'+d.mimeType+';base64,'+d.data;img.alt='Educational illustration for '+topic;node.append(make('div','nu-ai-head','✦ Nimbus visual · '+(d.model||'Cloudflare Workers AI')),img);thread.append(node);scroll();setStatus('Visual ready.');
  }catch(err){if(err?.name!=='AbortError')setStatus('Visual unavailable: '+(err.code||'NETWORK_ERROR')+(err.provider_status?' (provider HTTP '+err.provider_status+')':''),true)}finally{controller=null;busy(false)}
 });
 // Keep the existing, initialized model picker: move the DOM node, not its listeners.
 function insertTools(){const top=document.querySelector('.topbar .top-left'),picker=$('modelPicker'),composer=$('composer'),speed=$('nimbusSpeedControlFinal'),sendMain=$('sendBtn');if(!top||!picker||!composer||!sendMain)return;
  if(!$('nuStudyToolsBtn')){
   const wrap=make('div','nu-study-tools-wrap');const btn=make('button','','Study Tools ▾');btn.id='nuStudyToolsBtn';btn.type='button';btn.setAttribute('aria-expanded','false');const menu=make('div','');menu.id='nuStudyMenu';menu.hidden=true;
   [['Learning Studio','studio'],['Study plan','plan'],['Quiz','quiz'],['Study a file','file']].forEach(([label,act])=>{const b=make('button','',label);b.type='button';b.addEventListener('click',()=>{menu.hidden=true;btn.setAttribute('aria-expanded','false');if(act==='studio'){show();return}hide();const input=$('messageInput');if(!input)return;if(act==='plan')input.value='Help me make a study plan.';else if(act==='quiz')input.value='Quiz me one question at a time.';else{input.value='Help me study this attached file.';$('attachBtn')?.click()}input.focus()});menu.append(b)});
   wrap.append(btn,menu);top.insertBefore(wrap,picker);btn.addEventListener('click',e=>{e.stopPropagation();menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden))});document.addEventListener('click',e=>{if(!wrap.contains(e.target)){menu.hidden=true;btn.setAttribute('aria-expanded','false')}});
  }
  if(!picker.classList.contains('nu-composer-model')){composer.insertBefore(picker,speed||sendMain);picker.classList.add('nu-composer-model')}
 }
 insertTools();
 // V33.1 UI-only: move the existing model menu outside all clipped composer
 // containers. Keep the actual menu DOM node and its original event handlers.
 (function keepModelChoicesVisible(){
  const menu=$('modelMenu'),button=$('modelPickerBtn');
  if(!menu||!button)return;
  if(menu.parentElement!==document.body)document.body.appendChild(menu);
  function align(){
   if(button.getAttribute('aria-expanded')!=='true'||menu.classList.contains('hidden'))return;
   const r=button.getBoundingClientRect();
   const width=Math.min(Math.max(258,Math.round(r.width)),Math.max(200,window.innerWidth-20));
   const x=Math.max(10,Math.min(Math.round(r.right-width),window.innerWidth-width-10));
   const above=Math.max(110,Math.floor(r.top-24));
   const maxHeight=Math.max(110,Math.min(370,above));
   const rules={position:'fixed',left:x+'px',right:'auto',top:'auto',bottom:Math.max(10,Math.round(window.innerHeight-r.top+8))+'px',width:width+'px',minWidth:'0',maxHeight:maxHeight+'px',overflowY:'auto',overflowX:'hidden',zIndex:'2147483647',visibility:'visible'};
   for(const [key,value] of Object.entries(rules))menu.style.setProperty(key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),value,'important');
  }
  new MutationObserver(align).observe(button,{attributes:true,attributeFilter:['aria-expanded']});
  window.addEventListener('resize',align,{passive:true});
  window.addEventListener('scroll',align,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){
    menu.classList.add('hidden');menu.style.display='none';button.setAttribute('aria-expanded','false');button.focus();
  }});
 })();
})();

// V33.2: show the existing chat's thinking state inline (never as a right-side ad card).
(function nimbusInlineThinking(){
  'use strict';
  const agent=document.getElementById('agentAssist');
  const messages=document.getElementById('messages');
  const app=document.getElementById('app');
  if(!agent||!messages)return;
  const modelDescription=document.querySelector('.visual-model-row b');
  if(modelDescription) modelDescription.textContent='Cloudflare Workers AI';
  const row=document.createElement('div');
  row.className='message ai nu-inline-thinking';
  row.setAttribute('role','status');
  row.setAttribute('aria-label','Nimbus is preparing a reply');
  row.innerHTML='<div class="nu-inline-thinking-content"><span class="nu-inline-owl" aria-hidden="true"><img src="/assets/nimbus-v3461-brain.webp" alt=""></span><span class="nu-inline-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="nu-sr-only">Nimbus is thinking</span></div>';
  function reconcile(){
    const visible=!agent.classList.contains('hidden') && !app?.classList.contains('nu-workspace-active');
    if(visible){
      if(!row.isConnected)messages.appendChild(row);
      messages.scrollTop=messages.scrollHeight;
    }else if(row.isConnected)row.remove();
    // Avoid showing the retired provider label in existing visual cards.
    messages.querySelectorAll('.visual-kicker').forEach(el=>{
      if(/FLUX/i.test(el.textContent||''))el.textContent='CLOUDFLARE • VISUAL';
    });
  }
  const watcher=new MutationObserver(reconcile);
  watcher.observe(agent,{attributes:true,attributeFilter:['class']});
  watcher.observe(messages,{childList:true,subtree:false});
  if(app)watcher.observe(app,{attributes:true,attributeFilter:['class']});
  reconcile();
})();
