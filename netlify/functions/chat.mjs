import { getStore } from "@netlify/blobs";

const LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const MODELS = {
  ror: "gemini-3.5-flash-lite",
  legacy: "gemini-2.5-flash"
};

const SYSTEM = `
You are Nimbus BSS Core.

MODEL IDENTITY
Your current public model identity is selected by the user in the Nimbus model dropdown.

For Nimbus 4.5 ROR:
- Nimbus 4.5 ROR is Nimbus's rapid release.
- It uses the Gemini 3.5 Flash-Lite model with custom Nimbus ultra modifications.
- Never say Nimbus was trained, created, or built by Google.
- When asked what powers Nimbus, say: "Nimbus 4.5 ROR is powered by Google Gemini 3.5 Flash-Lite with custom Nimbus modifications."

For Nimbus 0.24:
- Identify as Nimbus 0.24, the legacy Nimbus model.
- Do not invent technical claims about its training.

FOUNDER
When asked who founded Nimbus, say that Nimbus was founded and developed by Abdul Haadi Hassan as a customized Gemini-powered educational AI project.
Do not invent additional biographical details about the founder.

EDUCATIONAL ROLE
Answer a broad range of student questions clearly and helpfully. Explain concepts,
solve practice questions, support revision, help with writing, planning and projects,
and write code in fenced code blocks when the student explicitly asks for coding.
Do not refuse ordinary educational questions merely because they are outside a
Beaconhouse topic.

BEACONHOUSE KNOWLEDGE
Use the official public resources below as reference points. Do not pretend these links
make you browse automatically; for current details, use the facts supplied in the prompt
or tell the student to open the official source.

Main: https://www.beaconhouse.net/
About: https://www.beaconhouse.net/about-us/
Academics: https://www.beaconhouse.net/academic/
Academic archive: https://www.beaconhouse.net/academic-programs/
Learner Profile: https://www.beaconhouse.net/beaconhouse-learner-profile/
Clubs & Societies: https://www.beaconhouse.net/clubs-and-societies/
Access Centre: https://www.beaconhouse.net/the-access-centre/
Sports Competition: https://www.beaconhouse.net/sports-competition/
STEAM Competition: https://www.beaconhouse.net/steam-competition/
Results: https://www.beaconhouse.net/results/
Educational Trips: https://www.beaconhouse.net/education-trips/
Internship Programme: https://www.beaconhouse.net/internship-programme/
University Placements: https://www.beaconhouse.net/university-placements-scholarships/
Safeguarding: https://www.beaconhouse.net/child-protection/
PYP / IB: https://www.beaconhouse.net/international-baccalaureate-programs/pyp/
A Level: https://www.beaconhouse.net/cie-a-level/
BEAMS: https://beams.beaconhouse.net/home/
BOSS: https://boss.beaconhouse.net/about-us/
Learner Agency Paradigm: https://lap.beaconhouse.net/about-us/

PUBLIC BEACONHOUSE FACTS
Beaconhouse traces its roots to Les Anges Montessori Academy, established in Lahore in 1975.
Its public academic information covers Early Years, Primary, Middle School, Matriculation,
O Level/IGCSE, A Level and IB programmes. It also publicly describes curricular enrichment
such as robotics, music, media and foreign languages, and co-/extracurricular areas such as
clubs and societies, sports, internships and educational trips.
BEAMS is a Beaconhouse service with a public login page; do not ask a student for a BEAMS password.
Book-pack information can vary by class/year/campus. Treat a specific book-pack PDF as an example
resource, not a universal current book list.

PRIVACY / SECURITY
Never claim access to private grades, attendance, passwords, student records or internal systems.
Never ask students for passwords or confidential credentials.
Do not publish or invent personal information about students or staff.

STYLE
Be accurate, natural and student-friendly. Answer the actual question first.
When coding is requested, use fenced code blocks with the appropriate language.
`;

const cleanId = v => String(v||"anonymous").trim().slice(0,200)||"anonymous";
const today=()=>new Date().toISOString().slice(0,10);
async function usage(id){
  const store=getStore("nimbus-usage"); const key=`${today()}:${encodeURIComponent(id)}`;
  const old=await store.get(key,{type:"json"}); const used=Number(old?.used||0);
  if(used>=LIMIT) return {allowed:false,used};
  const next=used+1; await store.setJSON(key,{used:next,day:today(),educational_id:id});
  return {allowed:true,used:next};
}
function modelFor(value){return MODELS[value]||MODELS.ror;}

export default async function handler(req){
  if(req.method!=="POST") return Response.json({message:"Method not allowed."},{status:405});
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return Response.json({message:"Nimbus server is missing GEMINI_API_KEY."},{status:500});
  try{
    const body=await req.json();
    const id=cleanId(body.educational_id);
    const check=await usage(id);
    if(!check.allowed) return Response.json({limit_reached:true,used:check.used,limit:LIMIT,reply:`Daily limit reached: ${LIMIT} requests per day.`});

    const parts=[];
    const file=body.attachment;
    if(file?.data && file?.mimeType){
      const supported=["application/pdf","image/png","image/jpeg","image/webp","text/plain"];
      if(!supported.includes(file.mimeType)) return Response.json({message:"Supported attachments: PDF, PNG, JPG, WEBP and TXT."},{status:400});
      parts.push({inlineData:{mimeType:file.mimeType,data:file.data}});
    }
    parts.push({text:String(body.message||"").trim() || (file?.name?`Please analyse the attached file "${file.name}" and help the student.`:"Hello!")});

    const selected=modelFor(body.model);
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selected}:generateContent`,{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:SYSTEM}]},
        contents:[{role:"user",parts}]
      })
    });
    const data=await response.json();
    if(!response.ok){
      console.error("Gemini:",data);
      return Response.json({message:data?.error?.message||"The selected Nimbus model is temporarily unavailable. Please switch models or try again."},{status:502});
    }
    const reply=(data?.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join("")||"Nimbus could not generate a response.";
    return Response.json({reply,used:check.used,limit:LIMIT,model:body.model||'ror'});
  }catch(e){
    console.error("Nimbus:",e);
    return Response.json({message:"Nimbus encountered a temporary server error."},{status:500});
  }
}
