/* Nimbus V34.6.6 — local learning ID only, no Supabase and no CAPTCHA. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const edu=$('eduId'),enter=$('enterNimbus'),notice=$('nimbusAuthStatus');
 const VALID=/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+edu\.pk$/i;
 const LOGIN_KEY='nimbus_local_guest_v3466';
 const CHAT_KEY='nimbus_local_chats_v3466';
 const DAY_KEY='nimbus_local_day_count_v3466';
 const LEARN_KEY='nimbus_local_learning_v3466';
 const label=(message,bad=false)=>{if(notice){notice.textContent=message;notice.style.color=bad?'#b91c1c':'#334155'}};
 function usage(){
  const day=new Date().toISOString().slice(0,10);
  try{const parsed=JSON.parse(localStorage.getItem(DAY_KEY)||'null');if(parsed?.day===day)return Math.min(50,Math.max(0,Number(parsed.used)||0))}catch(_){}
  return 0;
 }
 function setUsage(used){
  const day=new Date().toISOString().slice(0,10);
  localStorage.setItem(DAY_KEY,JSON.stringify({day,used:Math.max(0,Math.min(50,Number(used)||0))}));
  updateUsage(Math.max(0,Math.min(50,Number(used)||0)));
 }
 window.nimbusRefreshQuota=async()=>({ok:true,used:usage(),remaining:50-usage(),limit:50,day:new Date().toISOString().slice(0,10),note:'Local display only; not a shared global count.'});
 window.nimbusSetLocalUsage=setUsage;
 function showSignedOut(message){
  state.id='';state.accountProfile=null;state.chats=[];state.messages=[];state.currentChatId=null;
  $('app')?.classList.add('hidden');$('loginModal')?.classList.remove('hidden');
  $('messages')?.replaceChildren();renderHistory();if(message)label(message);
 }
 function beginGuest(email,restoring=false){
  if(!VALID.test(email)||email.length>254){label('Enter a valid email-shaped educational ID ending in .edu.pk.',true);return}
  // A new entry starts a clean session and cannot access another ID's previous chats.
  if(!restoring){sessionStorage.removeItem(CHAT_KEY);sessionStorage.removeItem(LEARN_KEY)}
  sessionStorage.setItem(LOGIN_KEY,email);
  state.id=email;state.accountProfile={email,role:'student',guest:true,verified:false};
  state.chats=[];state.messages=[];state.currentChatId=null;
  try{const raw=sessionStorage.getItem(CHAT_KEY);const saved=JSON.parse(raw||'[]');if(Array.isArray(saved))state.chats=saved.slice(0,40)}catch(_){}
  syncAccount();resetChat();renderHistory();
  $('loginModal')?.classList.add('hidden');$('app')?.classList.remove('hidden');
  setUsage(usage());
 }
 enter?.addEventListener('click',()=>beginGuest(String(edu?.value||'').trim().toLowerCase()));
 edu?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();beginGuest(String(edu?.value||'').trim().toLowerCase())}});
 $('signOut')?.addEventListener('click',()=>{
  if(!confirm('Sign out and clear this tab\'s Nimbus conversations?'))return;
  sessionStorage.removeItem(LOGIN_KEY);sessionStorage.removeItem(CHAT_KEY);sessionStorage.removeItem(LEARN_KEY);
  state.chats=[];state.messages=[];state.currentChatId=null;
  location.reload();
 });
 const previous=sessionStorage.getItem(LOGIN_KEY)||'';
 if(VALID.test(previous)&&previous.length<=254){beginGuest(previous,true)}
 else showSignedOut('Enter an educational ID ending in .edu.pk. No ownership verification is performed.');
})();
