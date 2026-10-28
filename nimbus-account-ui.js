/* Nimbus 34.7: persistent account sessions using an educational ID plus six-digit PIN; no email verification. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),edu=$('eduId'),pin=$('nimbusPin'),status=$('nimbusAuthStatus');
 const VALID=/^[a-z0-9._%+\-]+@(?:[a-z0-9-]+\.)+edu\.pk$/i;
 let signedIn=false, pending=false, chatQueue=Promise.resolve(),learnQueue=Promise.resolve();
 const loading=$('nimbusSessionLoading');const endLoading=()=>{loading?.remove()};
 const closeOverlays=()=>{for(const id of ['menuModal','ownerModal','infoModal','premiumModal','modelMenu'])$(id)?.classList.add('hidden');};
 const clearPin=()=>{if(pin)pin.value=''};
 const notice=(msg,bad=false)=>{if(status){status.textContent=msg;status.style.color=bad?'#b91c1c':'#334155'}};
 async function json(url,options){const res=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let data={};try{data=await res.json()}catch{}return {res,data}}
 async function loadRemote(){
  const [chats,learning,quota]=await Promise.all([json('/api/nimbus-chats?kind=chats'),json('/api/nimbus-chats?kind=learning'),json('/api/nimbus-quota')]);
  if(!chats.res.ok||!learning.res.ok)throw new Error('Your saved history could not be loaded. Try signing in again.');
  state.chats=Array.isArray(chats.data.chats)?chats.data.chats:[];
  state.messages=[];state.currentChatId=null;
  renderHistory();resetChat();
  window.nimbusLearningImport?.(learning.data.learning&&typeof learning.data.learning==='object'?learning.data.learning:{});
  if(quota.res.ok&&quota.data.ok)updateUsage(Number(quota.data.used)||0);
 }
 async function activate(user){
  state.id=String(user.email||'');state.accountProfile={email:state.id,role:'student',verified:false,passcode_account:true};
  await loadRemote();syncAccount();signedIn=true;
  closeOverlays();$('loginModal')?.classList.add('hidden');$('app')?.classList.remove('hidden');endLoading();
  window.nimbusRefreshQuota?.().catch(()=>{});
 }
 function showLogin(msg){
  endLoading();signedIn=false;closeOverlays();clearPin();state.id='';state.accountProfile=null;state.messages=[];state.chats=[];state.currentChatId=null;
  $('app')?.classList.add('hidden');$('loginModal')?.classList.remove('hidden');$('messages')?.replaceChildren();window.nimbusLearningImport?.({});renderHistory();
  syncAccount();notice(msg||'Create an account or sign in to your existing account.');
 }
 function sendQueued(kind,value){
  if(!signedIn)return Promise.resolve();
  const queue=kind==='chats'?chatQueue:learnQueue;
  const job=queue.catch(()=>{}).then(async()=>{const {res,data}=await json('/api/nimbus-chats?kind='+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({[kind]:value})});if(!res.ok)throw new Error(data.error_code||'History could not be saved.');});
  if(kind==='chats')chatQueue=job;else learnQueue=job;
  job.catch(e=>{console.warn('[Nimbus history]',e.message);notice('Saving history failed. Check your connection.',true)});
  return job;
 }
 window.nimbusPersistChats=chats=>sendQueued('chats',JSON.parse(JSON.stringify(chats.slice(0,40))));
 window.nimbusPersistLearning=learning=>sendQueued('learning',JSON.parse(JSON.stringify(learning)));
 window.nimbusRefreshQuota=async()=>{const {res,data}=await json('/api/nimbus-quota');if(res.ok&&data.ok){updateUsage(data.used);return data}return null};
 async function authenticate(action){if(pending)return;
  const email=String(edu?.value||'').trim().toLowerCase();
  const code=String(pin?.value||'').trim();
  if(!VALID.test(email)||email.length>254){notice('Enter a valid educational ID ending in .edu.pk.',true);return}
  if(!/^[0-9]{6}$/.test(code)){
   const n=code.length;
   notice(n===0?'Enter your six-digit passcode.':`Enter exactly six digits (currently ${n} characters). Only numbers 0-9 are accepted.`,true);
   pin?.focus();return;
  }
  pending=true;const buttons=[$('nimbusSignUp'),$('nimbusSignIn')];buttons.forEach(b=>{if(b)b.disabled=true});notice('Connecting to your Nimbus account...');
  try{const {res,data}=await json('/api/nimbus-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,educational_id:email,passcode:code})});
   if(!res.ok||!data.ok){notice(data.message||'Account request failed.',true);return}
   try{await activate(data.user);clearPin()}catch(e){notice('Your account signed in, but history could not load. Refresh Nimbus or retry. '+e.message,true)}
  }catch{notice('Unable to connect to Nimbus. Please try again.',true)}
  finally{pending=false;buttons.forEach(b=>{if(b)b.disabled=false})}
 }
 const resetStaleError=()=>{if(!pending)notice('Choose Sign in for an existing account or Create account for a new ID.');};
 edu?.addEventListener('input',resetStaleError);
 pin?.addEventListener('input',resetStaleError);
 $('nimbusSignUp')?.addEventListener('click',()=>authenticate('signup'));
 $('nimbusSignIn')?.addEventListener('click',()=>authenticate('signin'));
 pin?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();authenticate('signin')}});
 $('signOut')?.addEventListener('click',async()=>{
  if(pending||!signedIn)return;
  if(!confirm('Sign out of Nimbus on this device?'))return;
  pending=true;
  const button=$('signOut');if(button)button.disabled=true;
  closeOverlays();
  try{
   await Promise.allSettled([chatQueue,learnQueue]);
   const {res,data}=await json('/api/nimbus-account',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signout'})
   });
   if(!res.ok||!data.ok){
    alert(data.message||'Could not sign out. Please retry.');return;
   }
   window.nimbusLearningImport?.({});
   showLogin('Signed out. Your conversations remain in your Nimbus account. Sign in with the original six-digit passcode.');
  }catch{alert('Unable to reach Nimbus to sign out. Please retry.');}
  finally{pending=false;if(button)button.disabled=false;}
 });
 (async()=>{try{
  const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),15000);
  let response;
  try{response=await json('/api/nimbus-account',{signal:ctl.signal})}finally{clearTimeout(timeout)}
  if(response.res.ok&&response.data.user)await activate(response.data.user);
  else showLogin('Enter your educational ID and six-digit passcode.');
 }catch{showLogin('Cannot connect to the account service. Check your connection.')}})();
})();
