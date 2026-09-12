import { getStore } from "@netlify/blobs";

const LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM = `
You are Nimbus BSS Core, a customized educational AI assistant.

IDENTITY:
You are Nimbus BSS Core.

Nimbus is powered by the Google Gemini model with custom Nimbus modifications.

When asked what powers Nimbus, say:
"Nimbus is powered by Google Gemini with custom Nimbus modifications."

When asked who founded Nimbus, say:
"Nimbus was founded and developed by Abdul Haadi Hassan as a customized
Gemini-powered educational AI project."

When relevant, you may say:
"Nimbus 0.24 is the customized Gemini-powered version developed by
Abdul Haadi Hassan, founder of Nimbus."

Do not say that you were:
- trained by Google
- created by Google
- built by Google
- made by Google

Do not claim that Nimbus is officially owned, endorsed, or operated by
Beaconhouse unless explicit authorization exists.

If someone directly asks how Nimbus was developed or whether outside
assistance was involved, answer truthfully.

EDUCATIONAL ROLE:
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

Never claim access to:
- private grades
- attendance
- passwords
- student records
- internal Beaconhouse systems

Never ask students for passwords.

STYLE:
Be supportive, clear, energetic and useful.

Do not output code blocks unless the user specifically asks for code.
`;


function cleanId(value) {
    return String(value || "anonymous").trim().slice(0, 200) || "anonymous";
}


function todayUTC() {
    return new Date().toISOString().slice(0, 10);
}


async function checkUsage(educationalId) {
    const store = getStore("nimbus-usage");

    const key =
        `${todayUTC()}:${encodeURIComponent(educationalId)}`;

    const existing = await store.get(key, {
        type: "json"
    });

    const used = Number(existing?.used || 0);

    if (used >= LIMIT) {
        return {
            allowed: false,
            used
        };
    }

    const next = used + 1;

    await store.setJSON(key, {
        used: next,
        day: todayUTC(),
        educational_id: educationalId
    });

    return {
        allowed: true,
        used: next
    };
}


export default async function handler(request) {

    if (request.method !== "POST") {
        return new Response(
            JSON.stringify({
                message: "Method not allowed."
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }


    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return new Response(
            JSON.stringify({
                message: "GEMINI_API_KEY is not configured in Netlify."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }


    try {

        const body = await request.json();

        const message =
            String(body?.message || "").trim();

        const educationalId =
            cleanId(body?.educational_id);


        const usage =
            await checkUsage(educationalId);


        if (!usage.allowed) {

            return new Response(
                JSON.stringify({
                    limit_reached: true,
                    used: usage.used,
                    limit: LIMIT,
                    reply:
                        `Daily limit reached: ${LIMIT} requests per day.`
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }


        const parts = [];


        /*
         * FILE ATTACHMENT
         */

        const attachment = body?.attachment;


        if (
            attachment &&
            attachment.data &&
            attachment.mimeType
        ) {

            const supportedTypes = [
                "application/pdf",
                "image/png",
                "image/jpeg",
                "image/webp",
                "text/plain"
            ];


            if (
                !supportedTypes.includes(
                    attachment.mimeType
                )
            ) {

                return new Response(
                    JSON.stringify({
                        message:
                            "Supported attachments are PDF, PNG, JPG, WEBP and TXT."
                    }),
                    {
                        status: 400,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                );
            }


            parts.push({
                inlineData: {
                    mimeType: attachment.mimeType,
                    data: attachment.data
                }
            });
        }


        /*
         * USER MESSAGE
         */

        parts.push({
            text:
                message ||
                (
                    attachment?.name
                        ? `Please analyse the attached file "${attachment.name}" and help the student.`
                        : "Hello!"
                )
        });


        /*
         * GEMINI 3.8 FLASH
         */

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },

                body: JSON.stringify({

                    systemInstruction: {
                        parts: [
                            {
                                text: SYSTEM
                            }
                        ]
                    },

                    contents: [
                        {
                            role: "user",
                            parts: parts
                        }
                    ]

                })
            }
        );


        const data =
            await geminiResponse.json();


        /*
         * GEMINI ERROR
         */

        if (!geminiResponse.ok) {

            console.error(
                "Gemini API error:",
                data
            );

            return new Response(
                JSON.stringify({
                    message:
                        data?.error?.message ||
                        "Gemini could not process the request."
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }


        /*
         * GET RESPONSE TEXT
         */

        const reply =
            data
                ?.candidates?.[0]
                ?.content
                ?.parts
                ?.filter(
                    part =>
                        typeof part.text === "string"
                )
                ?.map(
                    part => part.text
                )
                ?.join("")
            ||
            "Nimbus could not generate a response.";


        return new Response(
            JSON.stringify({
                reply: reply,
                used: usage.used,
                limit: LIMIT
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );


    } catch (error) {

        console.error(
            "Nimbus server error:",
            error
        );


        return new Response(
            JSON.stringify({
                message:
                    "Nimbus encountered a temporary server error."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
}