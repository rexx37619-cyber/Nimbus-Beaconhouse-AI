import { getStore } from "@netlify/blobs";


const LIMIT = Number(
    process.env.NIMBUS_DAILY_LIMIT || 1500
);


// Primary model + reliability fallbacks.
const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash"
];


const SYSTEM = `
You are Nimbus BSS Core, a customized educational AI assistant for students.

IDENTITY
You are Nimbus BSS Core.

Nimbus is powered by Google Gemini with custom Nimbus modifications.

If asked "What powers Nimbus?", answer:
"Nimbus is powered by Google Gemini with custom Nimbus modifications."

If asked "Who founded Nimbus?", answer:
"Nimbus was founded and developed by Abdul Haadi Hassan as a customized
Gemini-powered educational AI project."

If asked about Nimbus 0.24, answer:
"Nimbus 0.24 is a customized Gemini-powered version developed by
Abdul Haadi Hassan, founder of Nimbus."

Never say:
- "I was trained by Google."
- "I was created by Google."
- "I was built by Google."
- "I am Google's AI."
- "Google created Nimbus."

If directly asked about how Nimbus was developed, answer truthfully.

Do not claim Nimbus is officially endorsed, owned, or operated by Beaconhouse
unless explicit authorization exists.

==================================================
BEACONHOUSE KNOWLEDGE
==================================================

Beaconhouse is an international education network that traces its roots to
Les Anges Montessori Academy, established in Lahore in November 1975 with
19 children.

Beaconhouse's official academic information publicly lists:
- Early Years
- Primary School
- Middle School
- Matriculation
- CIE O Level and IGCSE
- CIE A Level
- International Baccalaureate programmes

Beaconhouse also publicly describes:
- Learner Profile
- Robotics
- Music
- Media
- Foreign Languages
- Clubs and Societies
- Sports and Physical Education
- Educational Trips
- Internship programmes
- Student counselling
- The Access Centre for educational advising and university placement

The official Beaconhouse student portal uses Beaconite ID for student login.

Useful official sources:

https://www.beaconhouse.net/
https://www.beaconhouse.net/about-us/
https://www.beaconhouse.net/academic/
https://student.beaconhouse.net/
https://admissions.beaconhouse.net/
https://www.beaconhouse.net/the-access-centre/
https://www.beaconhouse.net/faq/tech/

When a user asks a Beaconhouse question that can be answered from the
public information above, answer it directly.

For current or campus-specific information that is not contained in the
known information above, say that the student should verify it with the
official Beaconhouse website or their campus.

Never invent:
- fees
- timetables
- exam schedules
- campus announcements
- private policies
- student records
- grades
- attendance
- passwords
- internal school systems

Never claim access to private Beaconhouse systems.

Never ask a student for a password.

==================================================
EDUCATIONAL ROLE
==================================================

Help students with:
- science
- mathematics
- English
- Urdu
- computer science
- revision
- assignments
- projects
- exam preparation
- IGCSE
- O Level
- A Level
- Matric/FSc
- university preparation
- study skills
- general educational questions

Be supportive, clear, energetic and useful.

Do not output code blocks unless the user explicitly asks for code.
`;


function cleanId(value) {

    return String(
        value || "anonymous"
    )
        .trim()
        .slice(0, 200)
        || "anonymous";
}


function todayUTC() {

    return new Date()
        .toISOString()
        .slice(0, 10);
}


async function checkUsage(educationalId) {

    const store =
        getStore("nimbus-usage");

    const key =
        `${todayUTC()}:${encodeURIComponent(educationalId)}`;

    const existing =
        await store.get(
            key,
            { type: "json" }
        );

    const used =
        Number(existing?.used || 0);


    if (used >= LIMIT) {

        return {
            allowed: false,
            used
        };
    }


    const next =
        used + 1;


    await store.setJSON(
        key,
        {
            used: next,
            day: todayUTC(),
            educational_id: educationalId
        }
    );


    return {
        allowed: true,
        used: next
    };
}


function isRetryable(status) {

    return (
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504
    );
}


async function callGemini(
    model,
    apiKey,
    contents
) {

    const response =
        await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "x-goog-api-key":
                        apiKey
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
                            parts: contents
                        }
                    ]

                })
            }
        );


    const data =
        await response.json();


    return {
        response,
        data
    };
}


export default async function handler(
    request
) {

    if (
        request.method !== "POST"
    ) {

        return new Response(
            JSON.stringify({
                message:
                    "Method not allowed."
            }),
            {
                status: 405,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }


    const apiKey =
        process.env.GEMINI_API_KEY;


    if (!apiKey) {

        return new Response(
            JSON.stringify({
                message:
                    "Nimbus server configuration is missing GEMINI_API_KEY."
            }),
            {
                status: 500,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }


    try {

        const body =
            await request.json();


        const message =
            String(
                body?.message || ""
            ).trim();


        const educationalId =
            cleanId(
                body?.educational_id
            );


        const usage =
            await checkUsage(
                educationalId
            );


        if (!usage.allowed) {

            return new Response(
                JSON.stringify({

                    limit_reached:
                        true,

                    used:
                        usage.used,

                    limit:
                        LIMIT,

                    reply:
                        `Daily limit reached: ${LIMIT} requests per day.`
                }),

                {
                    status: 200,

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }


        /*
         * BUILD CONTENT
         */

        const parts = [];


        const attachment =
            body?.attachment;


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
                            "Supported files are PDF, PNG, JPG, WEBP and TXT."
                    }),

                    {
                        status: 400,

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );
            }


            parts.push({

                inlineData: {

                    mimeType:
                        attachment.mimeType,

                    data:
                        attachment.data
                }

            });
        }


        parts.push({

            text:
                message ||

                (
                    attachment?.name

                    ?

                    `Please analyse the attached file "${attachment.name}" and help the student.`

                    :

                    "Hello!"
                )

        });


        /*
         * TRY GEMINI MODELS
         */

        let lastError = null;


        for (
            const model of MODELS
        ) {

            let attempts = 0;


            while (
                attempts < 2
            ) {

                attempts++;


                try {

                    const result =
                        await callGemini(
                            model,
                            apiKey,
                            parts
                        );


                    const response =
                        result.response;

                    const data =
                        result.data;


                    if (
                        response.ok
                    ) {

                        const reply =
                            data
                                ?.candidates?.[0]
                                ?.content?.parts
                                ?.filter(
                                    part =>
                                        typeof part.text === "string"
                                )
                                ?.map(
                                    part =>
                                        part.text
                                )
                                ?.join("")
                            ||

                            "Nimbus could not generate a response.";


                        return new Response(

                            JSON.stringify({

                                reply,

                                used:
                                    usage.used,

                                limit:
                                    LIMIT,

                                model:
                                    model

                            }),

                            {
                                status: 200,

                                headers: {

                                    "Content-Type":
                                        "application/json"
                                }
                            }
                        );
                    }


                    const apiMessage =
                        data?.error?.message
                        ||
                        `Gemini returned HTTP ${response.status}.`;


                    console.error(
                        `Gemini ${model} error:`,
                        apiMessage
                    );


                    lastError = {
                        model,
                        status:
                            response.status,
                        message:
                            apiMessage
                    };


                    /*
                     * Retry temporary overload/rate-limit errors.
                     */

                    if (
                        isRetryable(
                            response.status
                        )
                    ) {

                        if (
                            attempts < 2
                        ) {

                            await new Promise(
                                resolve =>
                                    setTimeout(
                                        resolve,
                                        1000
                                    )
                            );

                            continue;
                        }

                        break;
                    }


                    /*
                     * Permanent error:
                     * move directly to fallback model.
                     */

                    break;


                } catch (error) {

                    console.error(
                        `Nimbus ${model} network error:`,
                        error
                    );


                    lastError = {
                        model,
                        status: 500,
                        message:
                            error?.message ||
                            "Network error"
                    };


                    if (
                        attempts < 2
                    ) {

                        await new Promise(
                            resolve =>
                                setTimeout(
                                    resolve,
                                    1000
                                )
                        );

                        continue;
                    }
                }
            }
        }


        /*
         * ALL MODELS FAILED
         */

        console.error(
            "All Gemini fallback models failed:",
            lastError
        );


        let safeMessage =
            "Nimbus is temporarily busy. Please try again in a moment.";


        if (
            lastError?.status === 401 ||
            lastError?.status === 403
        ) {

            safeMessage =
                "Nimbus's Gemini connection needs to be checked by the owner.";
        }


        return new Response(

            JSON.stringify({

                message:
                    safeMessage,

                diagnostic:
                    lastError?.status || null

            }),

            {
                status: 503,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );


    } catch (error) {

        console.error(
            "Nimbus function error:",
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
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }
}