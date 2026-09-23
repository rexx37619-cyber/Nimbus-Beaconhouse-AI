import { GoogleGenAI } from '@google/genai';

const MODEL_CHAIN = [
  process.env.NIMBUS_CHAT_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash'
].filter((value, index, array) => value && array.indexOf(value) === index);

const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const MAX_HISTORY_MESSAGES = 16;
const MAX_HISTORY_CHARS = 24000;

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

CURRENT-TURN RULE — VERY IMPORTANT:
- Answer the CURRENT user request, not an earlier request.
- Never copy, repeat, or recycle a previous answer merely because the topic is similar.
- If the current request is different, give a genuinely different answer focused on the current request.
- Use previous turns only to understand references such as “it”, “this”, “the diaphragm”, or “the previous example”.
- Do not treat an old user message as the new request.

STYLE:
- Answer directly and naturally.
- Keep the answer useful and reasonably concise.
- Avoid backend diagnostics, provider names, error dumps, or loading narration.
- Do not use Markdown heading syntax with # and do not use **bold** markers in normal prose.
- For schoolwork, prefer keywords, concise facts, definitions, sequences, comparisons, labels, and answer structure.
- Do not provide polished ready-to-submit student paragraphs.
- For rewrites say: "You have to rephrase it on your own." Then give keywords/facts/structure.
- For Grade 7 science, use simple Beaconhouse Grade 7 language and the supplied source when available.
- Paraphrase rather than reproducing long textbook passages.

BEACONHOUSE:
- Beaconhouse questions are normal information questions, not science-visual questions.
- Do not generate a science visual merely because a Beaconhouse question contains words such as science, competition, class, book, academic, or program.

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

function normalizeRole(item) {
  const raw = String(
    item?.role ?? item?.sender ?? item?.type ?? (item?.isUser === true ? 'user' : '')
  ).toLowerCase().trim();

  if (raw === 'assistant' || raw === 'model' || raw === 'ai' || raw === 'nimbus') return 'model';
  return 'user';
}

function normalizeMessageText(item) {
  return String(
    item?.content ?? item?.text ?? item?.message ?? item?.parts?.map?.(part => part?.text || '').join(' ') ?? ''
  ).trim();
}

function compactHistory(history, currentUserText) {
  if (!Array.isArray(history)) return [];

  const cleaned = [];
  for (const item of history) {
    const text = normalizeMessageText(item);
    if (!text) continue;

    const role = normalizeRole(item);

    // If the frontend already included the current user turn in history,
    // remove only that trailing copy. We add the current turn exactly once below.
    if (role === 'user' && text === currentUserText) {
      const nextMeaningful = cleaned.length ? cleaned[cleaned.length - 1] : null;
      // Keep an identical older user message, but remove a copy that is effectively
      // the current submitted turn when it is the final item in the incoming array.
      // The final pass below also handles this case deterministically.
    }

    cleaned.push({ role, text });
  }

  // Drop a trailing user copy of the current request. This prevents
  // [current user] + [current user] from being sent when the frontend already
  // stores the message before calling /api/chat.
  while (
    cleaned.length &&
    cleaned[cleaned.length - 1].role === 'user' &&
    cleaned[cleaned.length - 1].text === currentUserText
  ) {
    cleaned.pop();
  }

  // Merge consecutive turns of the same role into one content item. This makes
  // histories from different frontend formats behave consistently.
  const merged = [];
  for (const item of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === item.role) {
      last.text = `${last.text}\n${item.text}`.trim();
    } else {
      merged.push({ ...item });
    }
  }

  // Keep the newest turns and enforce a character budget.
  const recent = merged.slice(-MAX_HISTORY_MESSAGES);
  const result = [];
  let totalChars = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const item = recent[i];
    if (totalChars + item.text.length > MAX_HISTORY_CHARS) break;
    result.unshift(item);
    totalChars += item.text.length;
  }

  // Gemini conversations should begin with a user turn.
  while (result.length && result[0].role === 'model') result.shift();

  return result.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
}

function buildContents(body, currentUserText) {
  const history = compactHistory(body?.history || body?.messages || [], currentUserText);
  history.push({ role: 'user', parts: [{ text: currentUserText }] });
  return history;
}

function isCasualMessage(text) {
  return /^(?:hi|hi nimbus|hello|hello nimbus|hey|hey nimbus|good morning|good afternoon|good evening|good night|thanks|thank you|thx|ok|okay|k|bye|goodbye|yo|how are you|how are u|who are you|what can you do|tell me a joke)[!.?\s]*$/i.test(String(text || '').trim());
}

function isBeaconhouseQuestion(text) {
  const s = String(text || '').toLowerCase();
  return /\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\blap\b|\bboss\b|\bbook\s*list\b|\bbooklist\b|\bcampus\b|\badmission|\badmissions\b|\bschool program|\bschool programme|\bcompetition\b|\blearner profile\b|\baccess centre\b|\bclubs?\s+(?:and|&)\s+societies\b/i.test(s);
}

function looksLikeScience(text) {
  return /\b(science|biology|chemistry|physics|ecosystem|food chain|food web|habitat|adaptation|cell|tissue|organs?|skeleton|joints?|muscles?|respiration|breathing|lungs?|heart|circulation|digestion|enzymes?|photosynthesis|reproduction|forces?|energy|electricity|circuit|atom|molecule|matter|acid|base|reaction|planet|solar system|rock|fossil|climate|weather|light|sound|wave|magnet|heat|temperature|density|pressure|friction|gravity|evaporation|condensation|diffusion|aerobic|anaerobic)\b/i.test(String(text || ''));
}

function hasEducationalIntent(text) {
  const s = String(text || '').trim();
  return /\b(explain|explanation|describe|what is|what are|define|definition|how does|how do|why does|why do|what does|what do|difference between|compare|comparison|function of|purpose of|types? of|how it works|how does it work|teach me|learn about|lesson|concept|process|steps?|sequence|diagram|label(?:led)?|example|class\s*7|grade\s*7|chapter|topic|revision|study)\b/i.test(s);
}

function explicitVisualRequest(text) {
  return /\b(show|draw|visuali[sz]e|diagram|label(?:led)? diagram|illustrate|illustration|picture|image|chart|flowchart|model)\b/i.test(String(text || ''));
}

function shouldVisualize(text) {
  const userText = String(text || '').trim();
  if (!userText || isCasualMessage(userText)) return false;
  if (isBeaconhouseQuestion(userText)) return false;

  const science = looksLikeScience(userText);
  const educational = hasEducationalIntent(userText);
  const explicit = explicitVisualRequest(userText);

  // Normal science teaching questions get a visual automatically.
  // Other subjects get a visual only when the user explicitly asks for one.
  return (science && educational) || explicit;
}

function classifyVisualKind(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(joints?|skeleton|bones?|muscles?|lungs?|heart|cells?|tissues?|organs?|brain|digest(?:ion)?|respiration|breathing|reproduction|kidneys?|stomach|intestines?|diaphragm)\b/.test(s)) {
    return 'accurate labelled anatomical or biological illustration';
  }
  if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food chain|food web|ecosystem|cycle|heat|temperature|diffusion|aerobic|anaerobic)\b/.test(s)) {
    return 'scientific system or process illustration showing real relationships and objects';
  }
  if (/\b(difference|compare|comparison)\b/.test(s)) {
    return 'side-by-side scientific comparison illustration';
  }
  if (/\b(steps|sequence|process|cycle|flowchart)\b/.test(s)) {
    return 'clean numbered process diagram';
  }
  return 'polished educational scientific illustration';
}

function stableVisualKey(text) {
  // Small deterministic fingerprint so the frontend can prevent accidental
  // double-rendering of the exact same backend visual result.
  let hash = 0;
  for (const char of String(text || '').trim().toLowerCase()) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return `science-${Math.abs(hash)}`;
}

function buildVisual(text, answer) {
  const kind = classifyVisualKind(text);
  const safeAnswer = String(answer || '').slice(0, 1200);
  return {
    id: stableVisualKey(text),
    type: 'diagram',
    title: String(text || 'Grade 7 science visual').slice(0, 80),
    prompt: `Create a high-quality 16:9 ${kind} for a Grade 7 educational science lesson.\n\nTopic/question: ${String(text || '').trim()}\n\nUseful answer points: ${safeAnswer}\n\nRequirements: make the visual topic-specific, scientifically coherent, visually rich, clear and classroom-ready. Use a strong focal subject, accurate relationships, depth or dimensionality where appropriate, concise readable labels, and leader lines/arrows only when they genuinely clarify the science. Prefer an actual scientific illustration or meaningful process diagram. NEVER use the same generic four-box template, generic rounded cards, placeholder circles, empty infographic panels, wireframes, text-only posters, or a repeated stock layout. Do not invent unsupported scientific structures or facts. Keep labels short and student-friendly.`
  };
}

function extractText(response) {
  if (typeof response?.text === 'string' && response.text.trim()) return response.text.trim();

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter(part => typeof part?.text === 'string')
    .map(part => part.text)
    .join(' ')
    .trim();
}

function extractSources(response) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .map(chunk => chunk?.retrievedContext)
    .filter(Boolean)
    .map(context => ({
      title: context.title || context.fileName || '',
      uri: context.uri || ''
    }))
    .filter(item => item.title || item.uri)
    .slice(0, 5);
}

async function callModel(ai, model, body, useScienceSearch) {
  const userText = String(body?.message || '').trim() || 'Hello!';
  const science = looksLikeScience(userText);

  const systemInstruction = `${BASE_SYSTEM}\n${BEACONHOUSE_KNOWLEDGE}${science ? '\nSOURCE MODE:\n- When Grade 7 science File Search returns relevant material, use it as the primary source for textbook-specific facts and terminology.\n- If the retrieved source is insufficient for a textbook-specific claim, say so rather than inventing it.' : ''}`;

  const config = {
    systemInstruction,
    maxOutputTokens: 1600,
    ...(useScienceSearch && SCIENCE_STORE_NAME ? {
      tools: [{ fileSearch: { fileSearchStoreNames: [SCIENCE_STORE_NAME] } }]
    } : {})
  };

  return ai.models.generateContent({
    model,
    contents: buildContents(body, userText),
    config
  });
}

async function callWithScienceFallback(ai, model, body, science) {
  if (!science || !SCIENCE_STORE_NAME) return callModel(ai, model, body, false);

  try {
    return await callModel(ai, model, body, true);
  } catch (err) {
    console.warn('[Nimbus chat] File Search request failed; retrying without File Search:', err?.message || err);
    return callModel(ai, model, body, false);
  }
}

function applyNoCacheHeaders(res, requestId) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Nimbus-Request-ID', requestId);
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  applyNoCacheHeaders(res, requestId);

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      reply: 'Nimbus is temporarily unavailable. Please try again.',
      error_code: 'MISSING_GEMINI_API_KEY'
    });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});

    const userText = String(body?.message || '').trim() || 'Hello!';
    const science = looksLikeScience(userText);
    const autoVisual = shouldVisualize(userText);
    const ai = new GoogleGenAI({ apiKey });

    let response = null;
    let usedModel = null;
    let lastError = null;

    for (const model of MODEL_CHAIN) {
      try {
        response = await callWithScienceFallback(ai, model, body, science);
        usedModel = model;
        break;
      } catch (err) {
        lastError = err;
        const status = Number(err?.status || err?.statusCode || 0);
        if (status === 404 || status === 429 || status >= 500) continue;
        throw err;
      }
    }

    if (!response) {
      console.error('[Nimbus chat] all models failed:', lastError?.message || lastError);
      return res.status(503).json({
        reply: 'Nimbus is temporarily unavailable. Please try again.',
        error_code: 'MODEL_REQUEST_FAILED'
      });
    }

    const answer = cleanText(extractText(response));
    if (!answer) {
      console.error('[Nimbus chat] model returned no text for request:', requestId);
      return res.status(503).json({
        reply: 'Nimbus could not produce a text response for that request. Please try again.',
        error_code: 'EMPTY_MODEL_RESPONSE'
      });
    }

    const payload = {
      reply: answer,
      auto_visual: autoVisual,
      visual: autoVisual ? buildVisual(userText, answer) : null,
      model: body?.model || 'ror',
      backend_model: usedModel,
      sources: science ? extractSources(response) : [],
      limit: DAILY_LIMIT,
      request_id: requestId
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error('[Nimbus chat]', err?.message || err);
    return res.status(503).json({
      reply: 'Nimbus is temporarily unavailable. Please try again.',
      error_code: 'CHAT_REQUEST_FAILED',
      request_id: requestId
    });
  }
}
