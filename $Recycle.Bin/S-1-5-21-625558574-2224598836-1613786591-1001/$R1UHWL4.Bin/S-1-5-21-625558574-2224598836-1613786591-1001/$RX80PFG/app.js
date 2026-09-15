const S={models:[
{id:"nimbus",name:"Nimbus",desc:"General learning"},
{id:"study",name:"Nimbus Study",desc:"Revision & practice"},
{id:"code",name:"Nimbus Code",desc:"Programming help"}],active:"nimbus",file:null};
const $=x=>document.getElementById(x); const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function active(){return S.models.find(x=>x.id===S.active)||S.models[0]}
function render(){
 $("models").innerHTML=S.models.map(m=>`<button class="model ${m.id===S.active?"active":""}" data-model="${m.id}"><span><i class="mi">${m.name[0]}</i>${m.name}</span>${m.id===S.active?"✓":""}</button>`).join("");
 $("menu").innerHTML=S.models.map(m=>`<button data-model="${m.id}"><b>${m.name}</b><br><small>${m.desc}</small></button>`).join("");
 $("activeName").textContent=active().name;$("stageModel").textContent=active().name;$("stageTitle").textContent=active().name+" workspace";
}
document.addEventListener("click",e=>{const x=e.target.closest("[data-model]");if(x){S.active=x.dataset.model;render();$("menu").classList.add("hidden");$("status").textContent=active().name+" is ready";}});
$("picker").onclick=()=>$("menu").classList.toggle("hidden");
$("newChat").onclick=$("clear").onclick=()=>{$("messages").innerHTML="";$("messages").classList.remove("show");$("welcome").style.display="block";$("status").textContent="Ready for your question"};
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{$("input").value=b.dataset.prompt;$("input").focus()});
$("attach").onclick=()=>$("file").click();
$("file").onchange=()=>{const f=$("file").files[0];if(!f)return;S.file=f;$("fileBox").classList.remove("hidden");$("fileBox").innerHTML=`📎 <b>${escape(f.name)}</b> · ${(f.size/1024).toFixed(1)} KB <button id="rm" style="float:right;border:0;background:none">×</button>`;$("status").textContent="File attached";$("rm").onclick=()=>{S.file=null;$("file").value="";$("fileBox").classList.add("hidden")}};
function add(role,text,fileName){$("welcome").style.display="none";$("messages").classList.add("show");const d=document.createElement("div");d.className="msg "+role;d.innerHTML=`<div class="bubble">${role==="ai"?'<div class="tag">'+escape(active().name.toUpperCase())+'</div>':''}${escape(text).replace(/\n/g,"<br>")}${fileName?`<div class="filein">📎 ${escape(fileName)}</div>`:""}</div>`;$("messages").appendChild(d);$("messages").scrollTop=$("messages").scrollHeight}
async function send(text){const f=S.file;add("user",text||"Please analyse my attachment.",f?.name);$("input").value="";S.file=null;$("file").value="";$("fileBox").classList.add("hidden");$("status").textContent=f?"Reading attachment…":"Thinking…";try{const fd=new FormData();fd.append("message",text||"");fd.append("model",S.active);fd.append("educational_id",localStorage.getItem("nimbusEducationalId")||"anonymous");if(f)fd.append("file",f);const r=await fetch("/api/chat",{method:"POST",body:fd});if(!r.ok)throw new Error();const d=await r.json();add("ai",d.reply||"No response returned.")}catch(e){add("ai","The interface is ready, but the Python backend is not connected. Put your existing agent in backend/agent.py and start the FastAPI server.");}finally{$("status").textContent="Ready for your next question"}}
$("composer").onsubmit=e=>{e.preventDefault();const t=$("input").value.trim();if(t||S.file)send(t)};
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit()}};
$("input").oninput=()=>{$("input").style.height="auto";$("input").style.height=Math.min($("input").scrollHeight,150)+"px"};
$("pause").onclick=()=>{$("pause").textContent=$("pause").textContent==="Pause"?"Resume":"Pause";$("status").textContent=$("pause").textContent==="Pause"?"Agent animation active":"Agent animation paused"};
document.querySelectorAll(".side-link").forEach(b=>b.onclick=()=>{$("modal").classList.remove("hidden");$("modalText").innerHTML=b.dataset.panel==="knowledge"?`<h2>Beaconhouse knowledge</h2><p>Nimbus can be seeded with approved school knowledge, curriculum guidance and public Beaconhouse information.</p><ul><li>Beaconhouse began in 1975 as Les Anges Montessori Academy.</li><li>Official pages list Early Years, Primary, Middle, Matriculation, O Level/IGCSE, A Level and IB programmes.</li><li>The official student portal uses Beaconite ID for student login.</li></ul>`:`<h2>Privacy & access</h2><p>Use approved school SSO for real authentication. Do not collect passwords here. Keep uploaded school work private and delete temporary files after processing unless your school policy requires retention.`});
$("close").onclick=()=>$("modal").classList.add("hidden");
$("signIn").onclick=async()=>{const id=$("eduId").value.trim();if(!id){$("loginmsg").textContent="Enter your educational ID.";return}$("loginmsg").textContent="Checking…";try{const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({educational_id:id})});const d=await r.json();if(r.ok&&d.ok){localStorage.setItem("nimbusEducationalId",id);$("login").classList.add("hidden");$("avatar").textContent=(d.display_name||id)[0].toUpperCase()}else $("loginmsg").textContent=d.message||"Authentication is not connected."}catch{localStorage.setItem("nimbusEducationalId",id);$("login").classList.add("hidden");$("avatar").textContent=id[0].toUpperCase();$("status").textContent="Demo session — connect SSO for production"}};
render();

$("adminBtn").onclick=()=>$("adminModal").classList.remove("hidden");
$("adminClose").onclick=()=>$("adminModal").classList.add("hidden");
$("adminLogin").onclick=async()=>{
  const email=$("adminEmail").value.trim();
  if(!email){$("adminMsg").textContent="Enter your owner email.";return}
  $("adminMsg").textContent="Checking owner access…";
  try{
    const r=await fetch("/api/admin/authorize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
    const d=await r.json();
    if(!r.ok || !d.ok){$("adminMsg").textContent=d.message||"Owner access denied.";return}
    $("adminAuth").classList.add("hidden");$("adminContent").classList.remove("hidden");
    $("adminContent").innerHTML=`
      <div class="stats">
        <div class="stat"><span>MONTHLY REVENUE</span><b>$${Number(d.metrics.monthly_revenue||0).toLocaleString()}</b></div>
        <div class="stat"><span>MESSAGES TODAY</span><b>${Number(d.metrics.messages_today||0).toLocaleString()}</b></div>
        <div class="stat"><span>DAILY LIMIT / USER</span><b>1,500</b></div>
        <div class="stat"><span>ACTIVE MODELS</span><b>${Number(d.metrics.active_models||0)}</b></div>
      </div>
      <div class="admin-grid">
        <div class="panel"><h3>Monthly revenue</h3>
          <div class="bar"><i style="width:72%"></i></div>
          <div class="bar"><i style="width:54%"></i></div>
          <div class="bar"><i style="width:84%"></i></div>
          <p style="font-size:10px;color:#888">Replace these demo bars with your billing database or payment provider's verified metrics.</p>
        </div>
        <div class="panel"><h3>Model operations</h3>
          <table class="table"><tr><th>Model</th><th>Status</th></tr>
          ${S.models.map(m=>`<tr><td>${escape(m.name)}</td><td>Connected</td></tr>`).join("")}
          </table>
        </div>
      </div>
      <div class="panel" style="margin-top:12px"><h3>Owner access</h3>
        <p style="font-size:11px;color:#666">Authorized owner: ${escape(d.email)}. Keep this dashboard server-protected and use real verified authentication in production.</p>
      </div>`;
  }catch{
    $("adminMsg").textContent="Backend unavailable. Start FastAPI first.";
  }
};
