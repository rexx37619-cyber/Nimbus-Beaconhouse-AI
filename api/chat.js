import { GoogleGenAI } from '@google/genai';

const MODELS = {
  // Primary: Gemini 3.5 Flash-Lite. Fast production fallbacks keep Nimbus responsive if one endpoint/quota path is unavailable.
  ror: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
  legacy: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']
};

const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);

const BEACONHOUSE_KNOWLEDGE = `
BEACONHOUSE PUBLIC KNOWLEDGE — USE ONLY AS A CURATED PUBLIC SNAPSHOT
- Nimbus is a student-built educational AI project with Beaconhouse-focused public knowledge. Do not claim Beaconhouse officially owns or endorses Nimbus.
- BISC: Beaconhouse International Student Convention. Official: https://bisc.beaconhouse.net/ ; About: https://bisc.beaconhouse.net/about-bisc/
  Public snapshot: a Beaconhouse student convention with public activities across sports, arts/creative, knowledge, gaming, science, entrepreneurship and culture. Public listings have included RoboQuest, Innovation Spark, BISC Icon, BISC Quiz, Art Extravaganza, Green Revolution Challenge, Film Festival, Quantum Quest and BISC Talks.
- RISE: https://rise.beaconhouse.net/ — Beaconhouse competition/platform pages; public listings have included Young Canvas, Beaconhouse Icon, BISC-related competitions and virtual sports.
- BEAMS: https://beams.beaconhouse.net/home/ — Beaconhouse digital platform. Never ask for or store BEAMS passwords and never claim access to private BEAMS records.
- PRISM: https://beams.beaconhouse.net/prism/ — professional development/e-learning resource associated with BEAMS.
- LAP: https://lap.beaconhouse.net/about-us/ ; 2026 guidelines: https://lap.beaconhouse.net/guidelines-2/ ; 2027 guidelines: https://lap.beaconhouse.net/guidelines-ilap-2027/ . Public materials describe Learner Agency Paradigm with learner agency, initiative, empathy, social responsibility, practical action and purposeful learning.
- BOSS: https://boss.beaconhouse.net/about-us/ — Beaconhouse Old Students Society public page.
- STEAM competition: https://www.beaconhouse.net/steam-competition/
- Sports competition: https://www.beaconhouse.net/sports-competition/
- Results archive: https://www.beaconhouse.net/results/
- Clubs & Societies: https://www.beaconhouse.net/clubs-and-societies/
- Academic: https://www.beaconhouse.net/academic/
- Main site: https://www.beaconhouse.net/
- Learner Profile: https://www.beaconhouse.net/beaconhouse-learner-profile/
- Access Centre: https://www.beaconhouse.net/the-access-centre/
- University placements & scholarships: https://www.beaconhouse.net/university-placements-scholarships/
- Internship programme: https://www.beaconhouse.net/internship-programme/
- Education trips: https://www.beaconhouse.net/education-trips/
- International events/trips: https://www.beaconhouse.net/international-events-trips/
- Official book-list portal: https://booklist.beaconhouse.net/
- Punjab: https://booklist.beaconhouse.net/punjab-booklist/
- Sindh & Balochistan: https://booklist.beaconhouse.net/sindh-balochistan-booklist/
- ICT: https://booklist.beaconhouse.net/ict-booklist/
- KPK: https://booklist.beaconhouse.net/kpk-booklist/
- TNS: https://booklist.beaconhouse.net/tns-booklist/
- Newlands Karachi: https://booklist.beaconhouse.net/newlands-booklist-khi/
- Newlands Islamabad: https://booklist.beaconhouse.net/newlands-booklist-isb/
- Newlands Lahore & Multan: https://booklist.beaconhouse.net/newlands-booklist-ml/
- Discovery Centre Karachi: https://booklist.beaconhouse.net/discovery-karachi-booklist/
RULES:
- When asked for current campus-specific book lists, say exact books vary by region/campus/academic year and direct the student to the relevant official portal unless the exact page data is present.
- Do not invent schedules, winners, private student data, campus records, or BEAMS information.
- If a specific Beaconhouse detail is not in this snapshot, say that it is not confirmed here and give the relevant official link.
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for students.
Identity:
- Nimbus was founded and developed by Abdul Haadi Hassan.
- Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer.
- Do not claim Beaconhouse officially owns or endorses Nimbus unless an official source supports that claim.
- If asked what powers Nimbus, say: Nimbus is powered by a Google model with custom Nimbus modifications.
- Never claim Nimbus was trained by Google or created by Google.

SPEED:
- Answer directly and quickly.
- Do not narrate backend work, retrieval, loading, provider errors, or diagnostics.
- Keep routine answers concise unless the student asks for depth.

ACADEMIC OUTPUT:
- For schoolwork, return concise study structure: Keywords, Key facts, and Answer structure. Add Key function(s) only when the question asks what something does/its purpose.
- Do NOT write a ready-to-submit paragraph for the student.
- Never include a "Key function(s)" section unless the student explicitly asks for a function or purpose.
- For rewrite requests, say exactly: "You have to rephrase it on your own." Then give only keywords, facts and structure.
- For Grade 7 science, explain in simple Beaconhouse Grade 7 language and use the supplied textbook source when available.
- Paraphrase in your own words. Do not reproduce long textbook passages.

STYLE:
- Do not use **bold** markers or Markdown heading syntax with # in normal prose.
- Use short labels and bullets where useful.
- No provider diagnostics.
- No filler such as "Connecting to Nimbus".

MEMORY:
- Use the supplied active-chat history as conversation context.
- Treat a new chat as a separate conversation.
- Do not infer facts about the student beyond what is in the active chat.
`;

function cleanText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[NIMBUS_VISUAL\][\s\S]*?\[\/NIMBUS_VISUAL\]/gi, '')
    .trim();
}

function compactHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map(item => {
    const roleRaw = String(item?.role || item?.sender || 'user').toLowerCase();
    const role = roleRaw === 'assistant' || roleRaw === 'model' || roleRaw === 'ai' ? 'model' : 'user';
    const text = String(item?.content ?? item?.text ?? item?.message ?? '').trim();
    return text ? { role, parts: [{ text }] } : null;
  }).filter(Boolean);
}

function looksLikeScience(text) {
  return /\b(science|biology|chemistry|physics|ecosystem|food chain|food web|habitat|adaptation|cell|tissue|organ|skeleton|joint|muscle|respiration|breathing|lungs|heart|circulation|digestion|enzyme|photosynthesis|reproduction|forces?|energy|electricity|circuit|atom|molecule|matter|states? of matter|acid|base|reaction|planet|solar system|rock|fossil|climate|weather|light|sound|waves?)\b/i.test(text);
}

function looksEducational(text) {
  return looksLikeScience(text) || /\b(explain|explanation|describe|how does|how do|why does|why do|difference between|compare|define|definition|teach me|learn|lesson|notes|revision|study|concept|process|steps|sequence|diagram|label|flowchart|example|class 7|grade 7|homework|school|exam|chapter|topic)\b/i.test(text);
}

function shouldVisualize(text) {
  // Automatic visuals are science-only. Beaconhouse, greetings, ordinary chat, and non-science homework do not auto-generate images.
  if (!looksLikeScience(text)) return false;
  return /\b(explain|explanation|describe|how does|how do|why does|why do|difference between|compare|define|definition|teach|lesson|notes|study|concept|process|steps|sequence|diagram|label|example|class 7|grade 7)\b/i.test(text);
}

function visualFor(text, answer) {
  const source = String(text || '').toLowerCase();
  let type = 'educational illustration';
  if (/\b(joint|skeleton|bone|muscle|lung|heart|cell|organ|brain|digest|respiration|reproduction)\b/.test(source)) type = 'accurate labelled anatomical or biological illustration';
  else if (/\b(circuit|electricity|force|energy|reaction|process|cycle|photosynthesis|respiration|digestion|food chain)\b/.test(source)) type = 'scientific process or experimental illustration';
  else if (/\b(difference|compare|comparison)\b/.test(source)) type = 'side-by-side scientific comparison';
  else if (/\b(steps|sequence|flowchart)\b/.test(source)) type = 'clean process diagram with numbered stages';
  return {
    type: 'diagram',
    title: String(text || 'Study visual').slice(0, 80),
    keywords: 'Grade 7; short labels; accurate relationships; no generic boxes',
    prompt: `Create a high-quality 16:9 ${type} for a Grade 7 Beaconhouse science lesson. Topic/question: ${text}. Core answer: ${String(answer || '').slice(0, 900)}. Use scientifically sensible proportions and visual relationships, concise labels, leader lines or arrows only where they clarify structure. Prefer a realistic or polished illustrated science visual over a generic infographic. Do not make a four-box template, text poster, empty placeholder, wireframe, or vague generic diagram. Use only short labels and avoid long paragraphs inside the image.`
  };
}

function extractText(response) {
  return response?.candidates?.[0]?.content?.parts?.filter(p => typeof p.text === 'string').map(p => p.text).join(' ').trim() || '';
}

function extractSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || response?.candidates?.[0]?.grounding_metadata?.grounding_chunks || [];
  const out = [];
  for (const chunk of chunks) {
    const rc = chunk?.retrievedContext || chunk?.retrieved_context;
    if (!rc) continue;
    const title = rc.title || rc.fileName || rc.file_name || '';
    const uri = rc.uri || '';
    if (title || uri) out.push({ title, uri });
  }
  return out.slice(0, 5);
}

function buildContents(body) {
  const history = compactHistory(body?.history || body?.messages || []);
  const userText = String(body?.message || '').trim() || 'Hello!';
  if (!history.length || history[history.length - 1]?.parts?.[0]?.text !== userText) {
    history.push({ role: 'user', parts: [{ text: userText }] });
  }
  return history;
}

async function callGemini(ai, model, body, useFileSearch) {
  const userText = String(body?.message || '').trim() || 'Hello!';
  const science = looksLikeScience(userText);
  const educational = looksEducational(userText);
  const system = `${BASE_SYSTEM}\n${BEACONHOUSE_KNOWLEDGE}\n${science ? '\nSOURCE MODE: When the Grade 7 science File Search tool returns relevant material, use it as the primary source. If the source does not contain enough information, say so instead of inventing source-specific details.\nIf File Search is unavailable, answer from general knowledge and clearly avoid inventing textbook-specific details.' : ''}`;

  const config = {
    systemInstruction: system,
    maxOutputTokens: 1600,
    ...(useFileSearch && SCIENCE_STORE_NAME ? {
      tools: [{ fileSearch: { fileSearchStoreNames: [SCIENCE_STORE_NAME] } }]
    } : {})
  };

  if (body?.attachment?.data && body?.attachment?.mimeType) {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
    if (allowed.includes(body.attachment.mimeType)) {
      const contents = buildContents(body);
      const last = contents[contents.length - 1];
      last.parts.unshift({ inlineData: { mimeType: body.attachment.mimeType, data: body.attachment.data } });
      return ai.models.generateContent({ model, contents, config });
    }
  }

  return ai.models.generateContent({ model, contents: buildContents(body), config });
}


async function callWithScienceFallback(ai, model, body) {
  const science = looksLikeScience(String(body?.message || ''));
  if (!science || !SCIENCE_STORE_NAME) {
    return callGemini(ai, model, body, false);
  }
  try {
    return await callGemini(ai, model, body, true);
  } catch (err) {
    // A broken/missing File Search store must never turn a normal science answer into the generic busy message.
    console.warn('[Nimbus science RAG] File Search unavailable; retrying without File Search:', err?.message || err);
    return callGemini(ai, model, body, false);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userText = String(body?.message || '').trim() || 'Hello!';
    const ai = new GoogleGenAI({ apiKey });
    const chain = MODELS[body?.model] || MODELS.ror;
    const wantsScience = looksLikeScience(userText);

    let response = null;
    let usedModel = null;

    for (const model of chain) {
      try {
        response = await callWithScienceFallback(ai, model, body);
        usedModel = model;
        break;
      } catch (err) {
        const code = Number(err?.status || err?.statusCode || 0);
        if (code === 429 || code >= 500) continue;
        throw err;
      }
    }

    if (!response) return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });

    const answer = cleanText(extractText(response) || 'I’m ready. What would you like to learn?');
      const autoVisual = shouldVisualize(userText);

    return res.status(200).json({
      reply: answer,
      visual: autoVisual ? visualFor(userText, answer) : null,
      auto_visual: autoVisual,
      model: body?.model || 'ror',
      backend_model: usedModel,
      sources: wantsScience ? extractSources(response) : [],
      limit: DAILY_LIMIT
    });
  } catch (err) {
    console.error('[Nimbus chat]', err?.message || err);
    return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });
  }
}
