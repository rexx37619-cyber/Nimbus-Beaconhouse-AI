/* Nimbus Learning Studio V32 — separate sidebar workspace, never replaces chat sender. */
(()=>{
  'use strict';
  const get=id=>document.getElementById(id);
  const panel=get('nimbusLearningPanel');
  const open=get('nimbusLearningOpen');
  const close=get('nlClose');
  if(!panel||!open||!close)return;

  const modes={
    hint_ladder:{title:'Hint Ladder',description:'Follow three clues to build your understanding.',button:'Generate three hints',index:'01'},
    answer_coach:{title:'Answer Coach',description:'Write your answer first. Nimbus helps you improve it.',button:'Review my answer',index:'02'},
    find_mistake:{title:'Find the Mistake',description:'Examine a statement and identify the single error.',button:'Create a challenge',index:'03'},
    creative_writing:{title:'Creative Writing',description:'Develop an original idea with prompts and feedback.',button:'Plan my writing',index:'04'}
  };
  const q=get('nlQuestion'),draft=get('nlDraft'),draftWrap=get('nlDraftWrap');
  const send=get('nlSend'),result=get('nlResult'),info=get('nlInfo');
  const empty=get('nlEmpty'),loading=get('nlLoading'),soundButton=get('nlSoundToggle');
  const cards=[...panel.querySelectorAll('[data-learning-mode]')];
  let mode='hint_ladder',hints=[],hintStep=0,currentChallenge='',lastQuestion='';
  let inFlight=null,sequence=0,soundsOn=true,audioCtx=null;

  function isReducedMotion(){return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;}
  function sound(){
    if(!soundsOn||isReducedMotion())return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      audioCtx=audioCtx||new Ctx();
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      const start=audioCtx.currentTime+.015;
      [659.25,880].forEach((freq,i)=>{
        const osc=audioCtx.createOscillator();const gain=audioCtx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(freq,start+i*.085);
        gain.gain.setValueAtTime(.0001,start+i*.085);
        gain.gain.exponentialRampToValueAtTime(.035,start+i*.085+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,start+i*.085+.22);
        osc.connect(gain);gain.connect(audioCtx.destination);
        osc.start(start+i*.085);osc.stop(start+i*.085+.24);
      });
    }catch{/* Sound is nonessential. Never block learning. */}
  }
  function unlockAudio(){
    if(!soundsOn)return;
    try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){audioCtx=audioCtx||new Ctx();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});}}catch{}
  }
  soundButton.addEventListener('click',()=>{
    soundsOn=!soundsOn;soundButton.setAttribute('aria-pressed',String(soundsOn));
    soundButton.textContent=soundsOn?'♫ Sounds on':'♫ Sounds off';
    if(soundsOn){unlockAudio();sound();}
  });

  function status(message,isError=false){info.textContent=String(message||'');info.dataset.error=isError?'true':'false';}
  function clear(){result.replaceChildren();empty.hidden=false;loading.hidden=true;}
  function line(label,text){
    const card=document.createElement('article');card.className='nl-result-card';
    const heading=document.createElement('b');heading.textContent=label;
    const p=document.createElement('p');p.textContent=String(text||'');
    card.append(heading,p);card.style.animationDelay=Math.min(result.children.length*65,325)+'ms';
    empty.hidden=true;result.append(card);return card;
  }
  function record(role,text){
    try{
      if(typeof ensureChat==='function'&&typeof add==='function'){
        ensureChat(lastQuestion||q.value||'Learning Studio');
        add(role,String(text).slice(0,1400));
      }
    }catch(e){console.warn('Nimbus learning history was not saved:',e);}
  }
  function draw(){
    cards.forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.learningMode===mode)));
    get('nlTitle').textContent=modes[mode].title;
    get('nlModeDescription').textContent=modes[mode].description;
    get('nlModeChip').textContent=modes[mode].index+' / 04';
    const needsDraft=mode==='answer_coach'||(mode==='find_mistake'&&Boolean(currentChallenge))||mode==='creative_writing';
    draftWrap.hidden=!needsDraft;
    get('nlDraftLabel').textContent=mode==='find_mistake'?'Which part is wrong? Explain your reasoning.':mode==='creative_writing'?'Your writing draft (optional)':'Your draft answer';
    q.placeholder=mode==='creative_writing'?'Describe your writing task or original story idea…':'Enter your school question or topic…';
    const action=mode==='find_mistake'&&currentChallenge?'Check my reasoning':mode==='creative_writing'&&draft.value.trim()?'Review my draft':modes[mode].button;
    send.replaceChildren(document.createTextNode(action+' '));
    const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='→';send.append(arrow);
  }
  function abortRequest(){sequence++;if(inFlight){inFlight.abort();inFlight=null;}send.disabled=false;}
  function setMode(next){
    if(!Object.hasOwn(modes,next))return;
    abortRequest();mode=next;hints=[];hintStep=0;currentChallenge='';draft.value='';
    clear();status('Guidance to help you think, not a ready-made answer.');draw();
  }
  cards.forEach(button=>button.addEventListener('click',()=>{setMode(button.dataset.learningMode);q.focus();}));
  draft.addEventListener('input',()=>{if(mode==='creative_writing')draw();});
  function show(){
    panel.hidden=false;get('app')?.classList.add('nl-workspace-active');
    open.setAttribute('aria-expanded','true');
    get('sidebar')?.classList.remove('open');
    panel.scrollTop=0;
    draw();
  }
  function hide(){
    if(panel.hidden)return;
    abortRequest();loading.hidden=true;if(!result.children.length)empty.hidden=false;panel.hidden=true;get('app')?.classList.remove('nl-workspace-active');
    open.setAttribute('aria-expanded','false');
  }
  open.addEventListener('click',()=>{show();});
  close.addEventListener('click',()=>{hide();get('messageInput')?.focus();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){hide();open.focus();}
  });
  // Original Nimbus actions always return to the real chat UI.
  ['newChat','clearChat','premiumModelsBtn','clearAll'].forEach(id=>{
    get(id)?.addEventListener('click',hide);
  });
  get('chatHistory')?.addEventListener('click',event=>{
    if(event.target.closest('.history-item'))hide();
  });
  document.querySelectorAll('[data-nl-quick]').forEach(button=>button.addEventListener('click',()=>{
    hide();
    const input=get('messageInput');if(!input)return;
    const action=button.dataset.nlQuick;
    if(action==='plan')input.value='Help me make a revision plan for my next test.';
    else if(action==='quiz')input.value='Quiz me one question at a time and wait for my answer before continuing.';
    else if(action==='file'){
      input.value='I am attaching school work. Analyse it and tell me what I should focus on.';
      get('attachBtn')?.click();
    }
    get('sidebar')?.classList.remove('open');input.focus();
  }));

  function describeError(response,data){
    const code=String(data?.error_code||'');
    if(response?.status===404||response?.status===405&& !code)return 'Learning API is not available on this site yet. Deploy /api/learning-v31 before testing.';
    if(code==='GEMINI_KEY_MISSING')return 'Gemini key is missing in this environment. Set GEMINI_API_KEY in Vercel or your local dev environment.';
    if(code==='LEARNING_PROVIDER_LIMIT'||response?.status===429)return 'The learning AI provider is rate-limited. Please try again shortly.';
    if(code==='LEARNING_RATE_LIMIT')return 'Please wait a moment before sending another learning request.';
    if(code==='LEARNING_TIMEOUT')return 'Nimbus learning took too long. Try again with a shorter topic.';
    if(code==='INVALID_MODEL_RESPONSE')return 'Nimbus received an incomplete learning response. Please retry.';
    if(code==='LEARNING_PROVIDER_ERROR'&&[401,403].includes(Number(data?.provider_status)))return 'Gemini credentials or model access were rejected in this environment (HTTP '+data.provider_status+').';
    if(code==='LEARNING_NETWORK_ERROR')return 'The learning server could not reach Gemini. Check your connection and Vercel logs.';
    if(code==='LEARNING_PROVIDER_ERROR'||code==='LEARNING_ALL_MODELS_UNAVAILABLE')return 'Gemini learning models are unavailable right now'+(data?.provider_status?' (HTTP '+data.provider_status+')':'')+'.';
    if(code==='MISSING_INPUT'||response?.status===400)return 'Please check your question and draft, then try again.';
    if(response?.status===503)return 'The learning API is not ready. Check Vercel environment variables and deployment logs.';
    if(response?.status===502)return 'The learning provider returned an error. Try again shortly.';
    return 'Learning guidance is temporarily unavailable. Check /api/learning-v31 in deployment logs.';
  }
  async function submit(){
    const question=q.value.trim();
    if(!question){q.focus();status('Enter a question or topic first.',true);return;}
    if(mode==='answer_coach'&&!draft.value.trim()){draft.focus();status('Write your draft answer first.',true);return;}
    if(mode==='find_mistake'&&currentChallenge&&!draft.value.trim()){draft.focus();status('Explain which part is wrong first.',true);return;}
    if(typeof state!=='undefined'&&typeof USAGE_LIMIT!=='undefined'&&state.used>=USAGE_LIMIT){status('Your daily Nimbus request limit has been reached.',true);return;}
    const action=mode==='answer_coach'?'review':mode==='find_mistake'&&currentChallenge?'check':mode==='creative_writing'&&draft.value.trim()?'review':'start';
    const request={mode,action,question,draft:draft.value.trim(),challenge:currentChallenge};
    abortRequest();const id=sequence;const controller=new AbortController();inFlight=controller;
    send.disabled=true;loading.hidden=false;empty.hidden=true;result.replaceChildren();
    status('Nimbus is preparing your learning guidance…');unlockAudio();
    try{
      const timer=setTimeout(()=>controller.abort(),30000);
      let response;
      try{response=await fetch('/api/learning-v31',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal});}
      finally{clearTimeout(timer);}
      const isJson=String(response.headers?.get('content-type')||'').includes('json');
      const data=isJson?await response.json().catch(()=>({})):{error_code:response.status===404?'MISSING_ROUTE':'NON_JSON_RESPONSE'};
      if(id!==sequence)return;
      if(!response.ok||!data.ok)throw new Error(describeError(response,data));
      if(typeof consumeLocalUsage==='function')consumeLocalUsage();
      lastQuestion=question;const payload=data.result||{};
      status('Think first, then improve your own response.');
      if(action==='start'&&mode==='hint_ladder'){
        hints=Array.isArray(payload.hints)?payload.hints.slice(0,3):[];hintStep=0;
        line('Your question',question);line('Hint 1 · Think first',hints[0]||'Start by identifying the main ideas.');
        if(payload.nextQuestion)line('Reflect',payload.nextQuestion);
        const next=document.createElement('button');next.className='nl-next';next.type='button';next.textContent='Unlock next hint →';
        next.addEventListener('click',()=>{
          if(hintStep>=2)return;hintStep++;
          line('Hint '+(hintStep+1),hints[hintStep]||'Use what you know to develop the next step.');
          record('ai','Hint '+(hintStep+1)+': '+(hints[hintStep]||''));
          if(hintStep===2)next.remove();sound();
        });result.append(next);
        record('user','[Hint Ladder] '+question);record('ai','Hint 1: '+(hints[0]||''));
      }else if(mode==='find_mistake'&&action==='start'){
        currentChallenge=String(payload.challenge||'');
        line('Find the single mistake',currentChallenge);line('Your turn',payload.prompt||'Spot the error and explain it.');
        draft.value='';record('user','[Find the Mistake] '+question);record('ai',currentChallenge);
      }else{
        const ordered=mode==='creative_writing'&&action==='start'
          ?[['Setting',payload.setting],['Writing challenge',payload.conflict],['Vocabulary',(payload.vocabulary||[]).join(' · ')],['Optional starter',payload.starter],['Your turn',payload.nextQuestion]]
          :mode==='find_mistake'?[['Feedback',payload.feedback],['Correction',payload.correction],['Think further',payload.nextQuestion]]
          :[['What you did well',payload.strength],['Try improving',payload.improve],['Revise this',payload.nextQuestion]];
        const summary=[];for(const [label,value] of ordered){if(value){line(label,value);summary.push(label+': '+value);}}
        if(mode==='find_mistake'){currentChallenge='';draft.value='';}
        record('user','['+modes[mode].title+'] '+question+(request.draft?' — Student draft: '+request.draft:''));
        record('ai',summary.join('\n\n'));
      }
      draw();sound();
      // On narrow screens, take students to the result rather than leaving it below the fold.
      if(window.innerWidth<=700)get('nlResponseTitle')?.scrollIntoView({behavior:isReducedMotion()?'auto':'smooth',block:'start'});
    }catch(error){
      if(id!==sequence)return;
      const timedOut=error?.name==='AbortError';
      status(timedOut?'The learning request timed out. Check your connection and try again.':error?.message||'Please retry.',true);
      empty.hidden=false;
    }finally{
      if(id===sequence){send.disabled=false;loading.hidden=true;inFlight=null;}
    }
  }
  send.addEventListener('click',submit);
  draw();
})();
