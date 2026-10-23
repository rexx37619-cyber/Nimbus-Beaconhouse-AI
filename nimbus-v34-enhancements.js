/* Nimbus V34: model menu, chat chime, opt-in preference, creative writing, visual branding. */
(()=>{
'use strict';
const reduce=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const getLocal=k=>{try{return window.localStorage.getItem(k)}catch{return null}};
const setLocal=(k,v)=>{try{window.localStorage.setItem(k,v)}catch{}};
const menu=document.getElementById('modelMenu');
const changeMenu=()=>{if(!menu)return;
 menu.querySelectorAll('[data-model="nano-banana-2"]').forEach(el=>el.remove());
 const legacy=menu.querySelector('[data-model="legacy"] small');if(legacy)legacy.textContent='Gemini 3.1 Flash-Lite · Legacy';
 const modern=menu.querySelector('[data-model="ror"] small');if(modern)modern.textContent='Gemini 3.5 Flash-Lite · Rapid';
};
if(menu){new MutationObserver(changeMenu).observe(menu,{childList:true,subtree:false});changeMenu()}
if(getLocal('nimbus_model')==='nano-banana-2'){setLocal('nimbus_model','ror');try{if(typeof state!=='undefined'){state.model='ror';renderModels()}}catch{}}
// V34.4: Help Improve opt-in control removed. Historical preference is not used.
document.getElementById('nuImproveBtn')?.remove();
const neutralAccountLabels=()=>{for(const id of ['accountName','menuName']){const el=document.getElementById(id);if(el&&/beaconhouse student/i.test(el.textContent||''))el.textContent='Nimbus learner';}};
neutralAccountLabels();
const accountRoot=document.getElementById('app');if(accountRoot){new MutationObserver(neutralAccountLabels).observe(accountRoot,{subtree:true,childList:true,characterData:true});}
// Subtle pop chime after the assistant finishes; respects browser audio rules.
const agent=document.getElementById('agentAssist'),messages=document.getElementById('messages');let played=false;
let ctx;
function pop(){try{if(reduce())return;const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;ctx ||=new Audio();if(ctx.state==='suspended')return;const t=ctx.currentTime;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(680,t);osc.frequency.exponentialRampToValueAtTime(1050,t+.10);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.018,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+.16);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.18)}catch{}}
const prepareAudio=()=>{if(!ctx){try{const A=window.AudioContext||window.webkitAudioContext;if(A)ctx=new A()}catch{}}ctx?.resume?.().catch(()=>{})};
document.getElementById('sendBtn')?.addEventListener('click',prepareAudio);
document.getElementById('composer')?.addEventListener('submit',prepareAudio);
if(agent){let prior=!agent.classList.contains('hidden');new MutationObserver(()=>{const current=!agent.classList.contains('hidden');if(prior&&!current&&played)pop();if(current)played=true;prior=current}).observe(agent,{attributes:true,attributeFilter:['class']});}
// Show the attached owl as the Learning Studio assistant indicator too.
const learning=document.getElementById('nimbusLearningPanel');
if(learning){const mo=new MutationObserver(()=>{learning.querySelectorAll('.nu-ai-head img').forEach(img=>{if(!img.src.endsWith('/assets/nimbus-thinking-owl.png'))img.src='/assets/nimbus-thinking-owl.png'})});mo.observe(learning,{subtree:true,childList:true});}
})();
