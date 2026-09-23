import { GoogleGenAI } from '@google/genai';

const MODEL_CHAIN = [
  process.env.NIMBUS_CHAT_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash'
].filter((v, i, a) => v && a.indexOf(v) === i);

const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);

const BEACONHOUSE_KNOWLEDGE = `
BEACONHOUSE PUBLIC KNOWLEDGE — CURATED OFFICIAL REFERENCES
- Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer. Do not claim Beaconhouse owns or endorses Nimbus.
- Main site: https://www.beaconhouse.net/
- Academics: https://www.beaconhouse.net/academic/
- Clubs & Societies: https://www.beaconhouse.net/clubs-and-societies/
- Learner Profile: https://www.beaconhouse.net/beaconhouse-learner-profile/
- Access Centre: https://www.beaconhouse.net/the-access-centre/
- Education Trips: https://www.beaconhouse.net/education-trips/
- International Events & Trips: https://www.beaconhouse.net/international-events-trips/
- Sports Competition: https://www.beaconhouse.net/sports-competition/
- STEAM Competition: https://www.beaconhouse.net/steam-competition/
- Results: https://www.beaconhouse.net/results/
- University Placements & Scholarships: https://www.beaconhouse.net/university-placements-scholarships/
- Internship Programme: https://www.beaconhouse.net/internship-programme/
- BISC: https://bisc.beaconhouse.net/
- BISC About: https://bisc.beaconhouse.net/about-bisc/
- RISE: https://rise.beaconhouse.net/
- BEAMS: https://beams.beaconhouse.net/home/
- BEAMS PRISM: https://beams.beaconhouse.net/prism/
- LAP: https://lap.beaconhouse.net/about-us/
- LAP Guidelines: https://lap.beaconhouse.net/guidelines-2/
- LAP iLAP 2027 Guidelines: https://lap.beaconhouse.net/guidelines-ilap-2027/
- BOSS: https://boss.beaconhouse.net/about-us/
- Official book-list portal: https://booklist.beaconhouse.net/
- Punjab book lists: https://booklist.beaconhouse.net/punjab-booklist/
- Sindh & Balochistan book lists: https://booklist.beaconhouse.net/sindh-balochistan-booklist/
- ICT book lists: https://booklist.beaconhouse.net/ict-booklist/
- KPK book lists: https://booklist.beaconhouse.net/kpk-booklist/
- TNS book lists: https://booklist.beaconhouse.net/tns-booklist/
- Newlands Karachi: https://booklist.beaconhouse.net/newlands-booklist-khi/
- Newlands Islamabad: https://booklist.beaconhouse.net/newlands-booklist-isb/
- Newlands Lahore & Multan: https://booklist.beaconhouse.net/newlands-booklist-ml/
- Discovery Centre Karachi: https://booklist.beaconhouse.net/discovery-karachi-booklist/
RULES:
- For exact current Beaconhouse facts, use only information actually supported by the supplied official references or the current user-visible context.
- Do not invent competition schedules, winners, campus records, private BEAMS data, or exact campus-specific book lists.
- When an exact current fact is not confirmed, say it is not confirmed here and provide the most relevant official link.
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for students.

IDENTITY:
- Nimbus was founded and developed by Abdul Haadi Hassan.
- Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer.
- Do not claim Beaconhouse officially owns or endorses Nimbus.
- If asked what powers Nimbus: Nimbus is powered by a Google model with custom Nimbus modifications.
- Never say Nimbus was trained by Google or created by Google.

STYLE:
- Answer directly.
- Avoid backend diagnostics, provider names, error dumps, or loading narration.
- Do not use Markdown heading syntax with # and do not use **bold** markers in normal prose.
- For schoolwork, prefer keywords, concise facts, definitions, sequences, comparisons, labels, and answer structure.
- Do not provide polished ready-to-submit student paragraphs.
- For rewrites say: "You have to rephrase it on your own." Then give keywords/facts/structure.
- For Grade 7 science, use simple Beaconhouse Grade 7 language and the supplied source when available.
- Paraphrase rather than reproducing long textbook passages.

MEMORY:
- Use the supplied active-chat history as context.
- A new chat is a separate conversation.
- Never invent facts about the student that are not in the active chat.
`;

function cleanText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[NIMBUS_VISUAL\][\s\S]*?\[\/NIMBUS_VISUAL\]/gi, '')
    .trim();
}

function compactHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map((item) => {
    const roleRaw = String(item?.role || item?.sender || '').toLowerCase();
    const role = ['assistant', 'model', 'ai'].includes(roleRaw) ? 'model' : 'user';
    const text = String(item?.content ?? item?.text ?? item?.message ?? '').trim();
    return text ? { role, parts: [{ text }] } : null;
  }).filter(Boolean);
}

function looksLikeScience(text) {
  return /\b(science|biology|chemistry|physics|ecosystem|food chain|food web|habitat|adaptation|cell|tissue|organ|skeleton|joint|muscle|respiration|breathing|lungs|heart|circulation|digestion|enzyme|photosynthesis|reproduction|forces?|energy|electricity|circuit|atom|molecule|matter|acid|base|reaction|planet|solar system|rock|fossil|climate|weather|light|sound|wave|magnet|heat|temperature)\b/i.test(text);
}

function shouldVisualize(text) {
  const science = looksLikeScience(text);
  const explanation = /\b(explain|explanation|describe|how does|how do|why does|why do|difference between|compare|define|definition|teach|lesson|concept|process|steps|sequence|diagram|label|example|class 7|grade 7)\b/i.test(text);
  return science && explanation;
}

function visualFor(text, answer) {
  const s = String(text || '').toLowerCase();
  let kind = 'polished scientific educational illustration';
  if (/\b(joint|skeleton|bone|muscle|lung|heart|cell|organ|brain|digestion|respiration|reproduction)\b/.test(s)) {
    kind = 'accurate labelled anatomical or biological illustration';
  } else if (/\b(circuit|electricity|force|energy|reaction|process|cycle|photosynthesis|food chain|food web|heat|temperature)\b/.test(s)) {
    kind = 'scientific process, experiment or system illustration';
  } else if (/\b(difference|compare|comparison)\b/.test(s)) {
    kind = 'side-by-side scientific comparison illustration';
  } else if (/\b(steps|sequence|process)\b/.test(s)) {
    kind = 'clean numbered process diagram';
  }
  return {
    type: 'diagram',
    title: String(text || 'Grade 7 science visual').slice(0, 80),
    keywords: 'Grade 7; concise labels; accurate relationships; artistic; no generic boxes',
    prompt: `Create a high-quality 16:9 ${kind} for a Grade 7 Beaconhouse science lesson. Topic/question: ${text}. Key answer points: ${String(answer || '').slice(0, 1000)}. Use an original polished educational illustration with strong visual hierarchy, realistic or well-designed scientific forms, clear focal subject, accurate relationships, short labels and leader lines/arrows only when useful. Prefer an actual science illustration over a poster. NEVER use the same generic four-box template, placeholder circles, text-only infographic, wireframe, or vague stock-style diagram. Do not invent unsupported scientific parts. Keep labels short and student-friendly.`
  };
}

function buildContents(body) {
  const history = compactHistory(body?.history || body?.messages || []);
  const userText = String(body?.message || '').trim() || 'Hello!';
  if (!history.length || history[history.length - 1]?.parts?.[0]?.text !== userText) {
    history.push({ role: 'user', parts: [{ text: userText }] });
  }
  return history;
}

function extractText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join(' ').trim();
}

function extractSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.map((chunk) => chunk?.retrievedContext)
    .filter(Boolean)
    .map((rc) => ({ title: rc.title || rc.fileName || '', uri: rc.uri || '' }))
    .filter((x) => x.title || x.uri)
    .slice(0, 5);
}

async function callModel(ai, model, body, withScienceSearch) {
  const userText = String(body?.message || '').trim() || 'Hello!';
  const science = looksLikeScience(userText);
  const systemInstruction = `${BASE_SYSTEM}\n${BEACONHOUSE_KNOWLEDGE}${science ? '\nSOURCE MODE: Use the Grade 7 File Search store as the primary source whenever relevant. If it does not contain enough information, say so rather than inventing source-specific details.' : ''}`;
  const config = {
    systemInstruction,
    maxOutputTokens: 1600,
    ...(withScienceSearch && SCIENCE_STORE_NAME ? {
      tools: [{ fileSearch: { fileSearchStoreNames: [SCIENCE_STORE_NAME], topK: 6 } }]
    } : {})
  };
  return ai.models.generateContent({ model, contents: buildContents(body), config });
}

async function safeCall(ai, model, body, science) {
  try {
    return await callModel(ai, model, body, science && Boolean(SCIENCE_STORE_NAME));
  } catch (firstErr) {
    if (science && SCIENCE_STORE_NAME) {
      console.warn('[Nimbus chat] File Search attempt failed; retrying text-only:', firstErr?.message || firstErr);
      return callModel(ai, model, body, false);
    }
    throw firstErr;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ reply: 'Nimbus is temporarily unavailable.', error_code: 'MISSING_GEMINI_API_KEY' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userText = String(body?.message || '').trim() || 'Hello!';
    const science = looksLikeScience(userText);
    const ai = new GoogleGenAI({ apiKey });

    let response = null;
    let usedModel = null;
    let lastError = null;

    for (const model of MODEL_CHAIN) {
      try {
        response = await safeCall(ai, model, body, science);
        usedModel = model;
        break;
      } catch (err) {
        lastError = err;
        const code = Number(err?.status || err?.statusCode || 0);
        if (code === 429 || code >= 500 || code === 404) continue;
        if (code === 400 && science && SCIENCE_STORE_NAME) continue;
        throw err;
      }
    }

    if (!response) {
      console.error('[Nimbus chat] all models failed:', lastError?.message || lastError);
      return res.status(503).json({ reply: 'Nimbus is temporarily unavailable. Please try again.', error_code: 'MODEL_REQUEST_FAILED' });
    }

    const answer = cleanText(extractText(response));
    const finalReply = answer || 'I can help with that. Please try the question again.';
    const autoVisual = shouldVisualize(userText);

    return res.status(200).json({
      reply: finalReply,
      visual: autoVisual ? visualFor(userText, finalReply) : null,
      auto_visual: autoVisual,
      model: body?.model || 'ror',
      backend_model: usedModel,
      sources: science ? extractSources(response) : [],
      limit: DAILY_LIMIT
    });
  } catch (err) {
    console.error('[Nimbus chat]', err?.message || err);
    return res.status(503).json({ reply: 'Nimbus is temporarily unavailable. Please try again.', error_code: 'CHAT_REQUEST_FAILED' });
  }
}
