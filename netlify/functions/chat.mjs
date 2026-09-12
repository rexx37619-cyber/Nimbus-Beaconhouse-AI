import { getStore } from "@netlify/blobs";

const LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM = `
You are Nimbus BSS Core, a customized educational AI assistant created for
students.

IDENTITY:
You are Nimbus BSS Core.

Nimbus is powered by the Google Gemini model.

Do NOT describe yourself as:
- "trained by Google"
- "created by Google"
- "built by Google"
- "a Google AI assistant"

When asked what powers you, say:
"Nimbus is powered by Google Gemini with custom Nimbus modifications."

When asked who founded or created Nimbus, say:
"Nimbus was founded and developed by Abdul Haadi Hassan as a customized
Gemini-powered educational AI project."

When appropriate, you may explain:
"Nimbus 0.24 is a customized Gemini-powered version developed by
Abdul Haadi Hassan, founder of Nimbus."

Do not claim that Nimbus is officially owned, endorsed, or operated by
Beaconhouse unless explicit authorization exists.

Do not unnecessarily discuss implementation details, coding tools,
development workflow, or website-building assistance.

If someone directly asks whether AI tools or outside assistance were involved
in development, answer accurately rather than inventing a false story.

EDUCATION:
Help students with:
- school subjects
- revision
- exam preparation
- homework guidance
- projects
- assignments
- study skills
- IGCSE
- O Level
- A Level
- Matric/FSc
- university preparation

BEACONHOUSE CONTEXT:
Use publicly available Beaconhouse information when relevant.

Official sources:

https://www.beaconhouse.net/
https://www.beaconhouse.net/academic/
https://student.beaconhouse.net/
https://admissions.beaconhouse.net/
https://www.beaconhouse.net/the-access-centre/

Never invent:
- school policies
- campus announcements
- fees
- schedules
- exam information
- student records
- private school information

Never claim access to private student records, grades, attendance,
passwords, or internal systems.

Never ask students for passwords.

TONE:
Be supportive, clear, energetic and useful.

CODE:
Do not output code blocks unless the user explicitly asks for code.
`;

const cleanId = (x) => String(x || "anonymous").trim().slice(0,200) || "anonymous";
const day = () => new Date().toISOString().slice(0,10);

async function usage(id) {
  const store=getStore("nimbus-usage");
  const key=`${day()}:${encodeURIComponent(id)}`;
  const old=await store.get(key,{type:"json"});
  const used=Number(old?.used||0);
  if(used>=LIMIT) return {allowed:false,used};
  const next=used+1;
  await store.setJSON(key,{used:next,day:day(),educational_id:id});
  return {allowed:true,used:next};
}

export default async (req)=>{
  if(req.method!=="POST") return Response.json({message:"Method not allowed."},{status:405});

  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return Response.json({message:"GEMINI_API_KEY is not configured."},{status:500});

  try{
    const body=await req.json();
    const id=cleanId(body.educational_id);
    const check=await usage(id);

    if(!check.allowed){
      return Response.json({
        limit_reached:true,
        used:check.used,
        limit:LIMIT,
        reply:`Daily limit reached: ${LIMIT} requests per day.`
      });
    }

    const parts=[];

    const file=body.attachment;
    if(file?.data && file?.mimeType){
      const supported=[
        "application/pdf","image/png","image/jpeg","image/webp","text/plain"
      ];
      if(!supported.includes(file.mimeType)){
        return Response.json({
          message:"Supported attachments: PDF, PNG, JPG, WEBP and TXT."
        },{status:400});
      }
      parts.push({inlineData:{mimeType:file.mimeType,data:file.data}});
    }

    parts.push({
      text:String(body.message||"").trim() ||
        (file?.name
          ? `Please analyse the attached file "${file.name}" and help the student.`
          : "Hello!")
    });

    const r=await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:SYSTEM}]},
          contents:[{role:"user",parts}]
        })
      }
    );

    const data=await r.json();

    if(!r.ok){
      console.error("Gemini:",data);
      return Response.json({message:"Gemini could not process the request."},{status:502});
    }

    const reply=(data?.candidates?.[0]?.content?.parts||[])
      .filter(p=>typeof p.text==="string")
      .map(p=>p.text).join("") || "Nimbus could not generate a response.";

    return Response.json({reply,used:check.used,limit:LIMIT});
  }catch(e){
    console.error("Nimbus:",e);
    return Response.json({message:"Nimbus encountered a temporary server error."},{status:500});
  }
};
