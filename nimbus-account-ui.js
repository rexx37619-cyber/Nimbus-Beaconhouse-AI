/* Nimbus V34.5: same-origin verified accounts, owner-isolated cloud chat records. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const notice=$('nimbusAuthStatus');
 const role=$('nimbusAccountRole'),grade=$('nimbusAccountGrade'),password=$('nimbusPassword'),email=$('eduId');
 const signup=$('nimbusSignUp'),signin=$('enterNimbus');
 const label=(message,bad=false)=>{if(notice){notice.textContent=message;notice.style.color=bad?'#b91c1c':'#334155'}};
 let busy=false;
 function changing(){ if(grade)grade.disabled=role.value!=='student'; }
 role?.addEventListener('change',changing);changing();
 async function api(path,init){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...init});const d=await r.json().catch(()=>({}));return {r,d};}
 async function refreshQuota(){
  const {r,d}=await api('/api/nimbus-quota');
  if(r.ok&&d.ok){state.used=d.used;state.usageStarted=Date.parse(d.day+'T00:00:00Z');updateUsage(d.used);return d;}
  return null;
 }
 window.nimbusRefreshQuota=refreshQuota;
 function showSignedOut(message){
   state.id='';state.chats=[];state.messages=[];state.currentChatId=null;
   $('app')?.classList.add('hidden');$('loginModal')?.classList.remove('hidden');
   $('messages')?.replaceChildren();renderHistory();
   if(message)label(message);
 }
 async function applySession(user){
  state.id=user.id;state.accountProfile=user;
  state.chats=[];state.messages=[];state.currentChatId=null;
  syncAccount();
  const {r,d}=await api('/api/nimbus-chats');
  if(!r.ok||!d.ok||!Array.isArray(d.chats)){throw new Error('Could not securely load account conversations.');}
  state.chats=d.chats;resetChat();renderHistory();
  $('loginModal')?.classList.add('hidden');$('app')?.classList.remove('hidden');
  await refreshQuota();
 }
 async function auth(action){
  if(busy)return;
  const address=email?.value.trim().toLowerCase(),pass=password?.value||'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address||'')){label('Enter a valid email address.',true);return;}
  if(pass.length<6){label('Use a password with at least 6 characters.',true);return;}
  const body={action,email:address,password:pass,role:role?.value||'student',grade:role?.value==='teacher'?'':grade?.value||''};
  busy=true;signin.disabled=true;signup.disabled=true;label(action==='signup'?'Creating account…':'Signing in…');
  try{
   const {r,d}=await api('/api/nimbus-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.ok||!d.ok){label(({
     INVALID_LOGIN:'Email or password was not accepted.',EMAIL_VERIFICATION_REQUIRED:'Verify your email before signing in.',SIGNUP_REJECTED:'Sign-up was not accepted. Check your email details and contact the Nimbus administrator if it continues.',SIGNUP_EMAIL_RATE_LIMIT:'Verification emails are temporarily limited. Please try later.',SIGNUP_EMAIL_NOT_AUTHORIZED:'Email verification is restricted by the current mail provider. The Nimbus administrator needs to configure email delivery.',INVALID_PROFILE:'Select a valid account type and grade.',ACCOUNT_SERVICE_UNAVAILABLE:'Account service not yet configured.'
   })[d.error_code]||'Account request failed. Try again later.',true);return;}
   password.value='';
   if(action==='signup'){label('Check your email for confirmation, then return here to sign in.');return;}
   await applySession(d.user);
  }catch{label('Account service unavailable, or conversations could not load. Try again.',true)}
  finally{busy=false;signin.disabled=false;signup.disabled=false}
 }
 signin?.addEventListener('click',()=>auth('signin'));
 signup?.addEventListener('click',()=>auth('signup'));
 password?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();auth('signin')}});
 $('signOut')?.addEventListener('click',async()=>{
   await api('/api/nimbus-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
   location.reload();
 });
 // Intentionally do NOT import the anonymous legacy chats into any account.
 showSignedOut('Checking for an existing Nimbus account session…');
 api('/api/nimbus-account').then(async({r,d})=>{
   if(r.ok&&d.ok&&d.user){try{await applySession(d.user)}catch{showSignedOut('Your account is available, but saved conversations could not be loaded. Please try again.')}}
   else showSignedOut('Sign in or create a verified Nimbus account.');
 }).catch(()=>showSignedOut('Sign in to access Nimbus.'));
})();
