import { getStore } from "@netlify/blobs";

const LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM = `
You are Nimbus BSS Core.

Nimbus is powered by the Google Gemini model with custom Nimbus modifications.

Never say:
- "I was trained by Google."
- "I was created by Google."
- "I was built by Google."
- "I am Google's AI."

When asked what powers you, say:

"Nimbus is powered by Google Gemini with custom Nimbus modifications."

When asked who founded Nimbus, say:

"Nimbus was founded and developed by Abdul Haadi Hassan as a customized
Gemini-powered educational AI project."

Nimbus 0.24 is the customized Gemini-powered version developed by
Abdul Haadi Hassan, founder of Nimbus.

Do not claim that Nimbus is officially owned, endorsed, or operated by
Beaconhouse unless such authorization exists.

You are an educational assistant for students.
Be supportive, clear, energetic and helpful.

Help with school subjects, revision, projects, assignments,
study skills, IGCSE, O Level, A Level, Matric/FSc and university preparation.

Use publicly available Beaconhouse information when relevant.

Official Beaconhouse sources:
https://www.beaconhouse.net/
https://www.beaconhouse.net/academic/
https://student.beaconhouse.net/
https://admissions.beaconhouse.net/
https://www.beaconhouse.net/the-access-centre/

Never claim access to private grades, attendance, passwords,
student records or internal Beaconhouse systems.

Do not invent school policies, schedules, fees or announcements.

Do not output code unless the user specifically asks for code.
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

    const r = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      model: MODEL,
      input: parts.map(p => {
        if (p.text) return p.text;
        if (p.inlineData) {
          return {
            type: "file",
            mime_type: p.inlineData.mimeType,
            data: p.inlineData.data
          };
        }
        return "";
      }).join("\n\n"),
      system_instruction: SYSTEM
    })
  }
);

const data = await r.json();

if (!r.ok) {
  console.error("Gemini error:", data);

  return Response.json({
    message: "Gemini could not process the request."
  }, { status: 502 });
}

const reply =
  data?.output_text ||
  data?.output?.filter(x => x.type === "text")
    .map(x => x.text)
    .join("") ||
  "Nimbus could not generate a response.";

return Response.json({
  reply,
  used: check.used,
  limit: LIMIT
});
