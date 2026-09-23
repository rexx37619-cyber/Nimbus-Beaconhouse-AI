const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);

const MODEL_CHAIN = [
  String(process.env.NIMBUS_CHAT_MODEL || 'gemini-3.5-flash-lite').trim(),
  'gemini-3.1-flash-lite'
].filter((value, index, array) => value && array.indexOf(value) === index);

const MAX_HISTORY_MESSAGES = 14;
const MAX_HISTORY_CHARS = 18000;
const NORMAL_TIMEOUT_MS = 6500;
const SCIENCE_TIMEOUT_MS = 4500;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const BEACONHOUSE_KNOWLEDGE = `
BEACONHOUSE PUBLIC KNOWLEDGE — CURATED REFERENCES ONLY
- Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer. Do not claim Beaconhouse owns, endorses, or operates Nimbus unless an official source specifically supports that claim.
- Main site: https://www.beaconhouse.net/
- Academics: https://www.beaconhouse.net/academic/
- BISC: https://bisc.beaconhouse.net/
- BEAMS: https://beams.beaconhouse.net/home/
- BEAMS PRISM: https://beams.beaconhouse.net/prism/
- RISE: https://rise.beaconhouse.net/
- LAP: https://lap.beaconhouse.net/about-us/
- BOSS: https://boss.beaconhouse.net/about-us/
- Clubs & Societies: https://www.beaconhouse.net/clubs-and-societies/
- Learner Profile: https://www.beaconhouse.net/beaconhouse-learner-profile/
- Access Centre: https://www.beaconhouse.net/the-access-centre/
- STEAM Competition: https://www.beaconhouse.net/steam-competition/
- Sports Competition: https://www.beaconhouse.net/sports-competition/
- Official book lists: https://booklist.beaconhouse.net/

BEACONHOUSE RULES:
- Treat Beaconhouse questions as normal information questions, not automatic science-visual requests.
- Do not invent schedules, winners, eligibility rules, private student data, campus records, or exact campus-specific book lists.
- A URL is a source reference, not proof that the current page contents have been retrieved.
- When the supplied Beaconhouse context does not confirm an exact current fact, say that it is not confirmed here and give the relevant official URL.
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for students.

CURRENT-TURN PRIORITY:
- Answer ONLY the user's current message.
- Never recycle an earlier answer just because a previous question was similar.
- Use chat history only for necessary references such as "it", "this", "the diaphragm", or "the previous answer".
- The current user message is always the task to answer.

NORMAL CHAT:
- Greetings, casual conversation, and normal Beaconhouse information questions should receive normal conversational answers.
- Do not create science visuals for greetings or Beaconhouse questions.

EDUCATIONAL OUTPUT:
- For educational/school questions, do not produce polished ready-to-submit essays unless the user explicitly requests prose for a non-schoolwork context.
- Prefer this exact structure when the request is educational:
  Keywords: concise topic terms.
  Answer structure: a short step-by-step structure the student can use.
  Key fact (8 shuffled words): exactly 8 topic-relevant words in varied order, not a sentence.
  Explanation: a short, clear explanation in original wording.
- Keep the wording suitable for a school student.
- Do not add filler about backend systems, retrieval, providers, loading, or diagnostics.

SCIENCE SOURCE RULES:
- For Grade 7 science questions, when File Search returns relevant textbook material, use it as the primary source for textbook-specific facts and terminology.
- You may add a small amount of general educational context when it directly helps understanding, but do not invent or contradict textbook-specific claims.
- Do not reproduce long textbook passages. Paraphrase.
- When the source is insufficient for a textbook-specific claim, say so instead of guessing.

TEXTBOOK SOURCE:
- The supplied Grade 7 source is Lower Secondary Science, Grade 7, Peter D. Riley, Third Edition, Based on SNC 2022.
`;

function cleanText(value) {
  return String(value || '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[NIMBUS_VISUAL\][\s\S]*?\[\/NIMBUS_VISUAL\]/gi, '')
    .trim();
}

function normalizeRole(item) {
  const raw = String(
    item?.role ?? item?.sender ?? item?.type ?? (item?.isUser === true ? 'user' : '')
  ).toLowerCase().trim();
  return ['assistant', 'model', 'ai', 'nimbus'].includes(raw) ? 'model' : 'user';
}

function normalizeMessageText(item) {
  if (typeof item === 'string') return item.trim();
  const parts = Array.isArray(item?.parts)
    ? item.parts.map(part => typeof part?.text === 'string' ? part.text : '').join(' ')
    : '';
  return String(item?.content ?? item?.text ?? item?.message ?? parts ?? '').trim();
}

function buildHistory(history, currentUserText) {
  if (!Array.isArray(history)) return [];

  const cleaned = [];
  for (const item of history) {
    const text = normalizeMessageText(item);
    if (!text) continue;
    cleaned.push({ role: normalizeRole(item), text });
  }

  // The frontend may persist the current user message before calling the API.
  // Remove trailing copies so the live request is sent exactly once.
  while (
    cleaned.length > 0 &&
    cleaned[cleaned.length - 1].role === 'user' &&
    cleaned[cleaned.length - 1].text === currentUserText
  ) {
    cleaned.pop();
  }

  // Normalize malformed histories with consecutive same-role messages.
  const merged = [];
  for (const item of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === item.role) {
      last.text = `${last.text}\n${item.text}`.trim();
    } else {
      merged.push({ ...item });
    }
  }

  let recent = merged.slice(-MAX_HISTORY_MESSAGES);
  let charCount = 0;
  const bounded = [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const item = recent[i];
    if (charCount + item.text.length > MAX_HISTORY_CHARS) break;
    bounded.unshift(item);
    charCount += item.text.length;
  }
  recent = bounded;

  // Gemini conversation history should not begin with a model turn.
  while (recent.length && recent[0].role === 'model') recent.shift();

  return recent.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
}

function buildContents(body, currentUserText) {
  const contents = buildHistory(body?.history || body?.messages || [], currentUserText);
  contents.push({ role: 'user', parts: [{ text: currentUserText }] });
  return contents;
}

function isCasualMessage(text) {
  return /^(?:hi|hi nimbus|hello|hello nimbus|hey|hey nimbus|yo|sup|what'?s up|how are you|how are u|good morning|good afternoon|good evening|good night|thanks|thank you|thx|ok|okay|k|bye|goodbye|who are you|what can you do|tell me a joke)[!.?\s]*$/i.test(String(text || '').trim());
}

function isBeaconhouseQuestion(text) {
  const s = String(text || '').toLowerCase();
  return /\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\blap\b|\bboss\b|\bbook\s*list\b|\bbooklist\b|\bcampus\b|\badmissions?\b|\bschool\s+(?:program|programme)\b|\bcompetition\b|\blearner\s+profile\b|\baccess\s+centre\b|\bclubs?\s+(?:and|&)\s+societies\b/i.test(s);
}

function looksLikeScience(text) {
  return /\b(?:science|biology|chemistry|physics|ecosystem(?:s)?|food\s+chain|water\s+cycle|carbon\s+cycle|nitrogen\s+cycle|food\s+web|habitat(?:s)?|adaptation(?:s)?|cell(?:s)?|tissue(?:s)?|organ(?:s)?|skeleton(?:s)?|joint(?:s)?|muscle(?:s)?|respiration|breathing|lung(?:s)?|heart|circulation|digestion|enzyme(?:s)?|photosynthesis|diaphragm|reproduction|force(?:s)?|energy|electricity|circuit(?:s)?|atom(?:s)?|molecule(?:s)?|matter|acid(?:s)?|base(?:s)?|reaction(?:s)?|planet(?:s)?|solar\s+system|rock(?:s)?|fossil(?:s)?|climate|weather|light|sound|wave(?:s)?|magnet(?:s)?|heat|temperature|density|pressure|friction|gravity|evaporation|condensation|diffusion|aerobic|anaerobic)\b/i.test(String(text || ''));
}

function hasAcademicSubject(text) {
  return /\b(?:math|maths|algebra|arithmetic|geometry|equation(?:s)?|fraction(?:s)?|percentage(?:s)?|ratio(?:s)?|statistics|probability|mean|median|mode|english|grammar|writing|literature|poetry|reading|noun(?:s)?|verb(?:s)?|adjective(?:s)?|adverb(?:s)?|sentence(?:s)?|paragraph(?:s)?|history|geography|civics|map(?:s)?|culture|civilization|revolution|empire|ancient|medieval|timeline|computer\s+science|ict|coding|programming|algorithm(?:s)?|biology|chemistry|physics|science|water\s+cycle|carbon\s+cycle|nitrogen\s+cycle|solar\s+system|planet(?:s)?|homework|schoolwork|exam|revision|lesson|chapter|class\s*\d+|grade\s*\d+)\b/i.test(String(text || ''));
}

function hasEducationalIntent(text) {
  return /\b(?:explain|explanation|describe|define|definition|what\s+is|what\s+are|what\s+does|what\s+do|how\s+does|how\s+do|why\s+does|why\s+do|difference\s+between|compare|comparison|function\s+of|purpose\s+of|types?\s+of|how\s+it\s+works?|teach\s+me|learn\s+about|lesson|concept|process|steps?|sequence|example|diagram|label(?:led)?|flowchart|solve|calculate|find|prove|derive|revise|revision|study|notes)\b/i.test(String(text || ''));
}

function looksLikeMathProblem(text) {
  const s = String(text || '');
  return /(?:\d|x|y)\s*(?:[+\-*/^=]|÷|×)|(?:solve|calculate|find)\b/i.test(s);
}

function isEducationalQuestion(text) {
  const s = String(text || '').trim();
  if (!s || isCasualMessage(s) || isBeaconhouseQuestion(s)) return false;
  const academicContext = hasAcademicSubject(s) || looksLikeScience(s) || looksLikeMathProblem(s) || /\b(?:school|student|classroom|class\s*\d+|grade\s*\d+|homework|schoolwork|exam|lesson|chapter|revision|study|notes|subject)\b/i.test(s);
  return hasEducationalIntent(s) && academicContext;
}

function explicitVisualRequest(text) {
  return /\b(?:show|draw|visuali[sz]e|illustrate|illustration|diagram|label(?:led)?|picture|image|chart|flowchart|model)\b/i.test(String(text || ''));
}

function shouldVisualize(text) {
  const s = String(text || '').trim();
  if (!isEducationalQuestion(s)) return false;
  if (isCasualMessage(s) || isBeaconhouseQuestion(s)) return false;
  return true;
}

function classifyVisualKind(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(joints?|skeleton|bones?|muscles?|lungs?|heart|cells?|tissues?|organs?|brain|digestion|respiration|breathing|reproduction|kidneys?|stomach|intestines?|diaphragm)\b/.test(s)) {
    return 'a scientifically accurate labelled anatomical or biological illustration';
  }
  if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food\s+chain|food\s+web|ecosystem|cycle|heat|temperature|diffusion|aerobic|anaerobic)\b/.test(s)) {
    return 'a scientifically accurate system or process illustration with meaningful objects and relationships';
  }
  if (/\b(algebra|equation|fraction|geometry|ratio|percentage|probability|statistics)\b/.test(s)) {
    return 'a clear educational mathematics visual showing the quantities, steps, symbols, and relationships';
  }
  if (/\b(history|geography|climate|map|civilization|war|empire)\b/.test(s)) {
    return 'a clear educational history or geography visual with meaningful places, objects, or timelines';
  }
  return 'a polished educational illustration that directly represents the lesson concept';
}

function createVisualPayload(question, answer) {
  const kind = classifyVisualKind(question);
  const answerExcerpt = String(answer || '').slice(0, 1000);
  return {
    id: `nimbus-visual-${stableHash(question)}`,
    type: 'diagram',
    title: String(question).slice(0, 90),
    prompt: `Create a high-quality 16:9 ${kind} for a student lesson.\n\nTopic/question: ${question}\n\nUseful answer points: ${answerExcerpt}\n\nVisual requirements: topic-specific, scientifically or academically coherent, visually rich, clear hierarchy, strong focal subject, accurate relationships, concise labels, useful arrows/callouts only when they clarify meaning. Prefer a real educational illustration, meaningful diagram, cutaway, process, map, timeline, or mathematical visualization as appropriate. Do not use a generic four-box template, generic cards, empty panels, wireframes, text-only poster, vague stock layout, or repetitive template. Keep labels short. Do not invent unsupported facts.`
  };
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value || '').toLowerCase()) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter(part => typeof part?.text === 'string')
    .map(part => part.text)
    .join(' ')
    .trim();
}

function extractSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
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


async function requestGemini({ apiKey, model, contents, systemInstruction, useFileSearch, timeoutMs }) {
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
  const tools = useFileSearch && SCIENCE_STORE_NAME
    ? [{ fileSearch: { fileSearchStoreNames: [SCIENCE_STORE_NAME] } }]
    : undefined;

  const payload = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      maxOutputTokens: 900,
      thinkingConfig: { thinkingLevel: 'minimal' }
    }
  };
  if (tools) payload.tools = tools;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || NORMAL_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 500) };
    }

    if (!response.ok) {
      const message = data?.error?.message || `Gemini API returned HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    const message = data?.error?.message || `Gemini API returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function isEducationalQuestionForNimbus(text) {
  return isEducationalQuestion(text);
}

export function shouldVisualizeForNimbus(text) {
  return shouldVisualize(text);
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Nimbus-Request-ID', requestId);

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reply: 'Method Not Allowed', request_id: requestId });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      reply: 'Nimbus is temporarily unavailable. Please try again in a moment.',
      error_code: 'MISSING_GEMINI_API_KEY',
      auto_visual: false,
      visual: null,
      request_id: requestId
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body || '{}');
    }
    body = body || {};

    const userText = String(body?.message || '').trim();
    if (!userText) {
      return res.status(200).json({
        ok: false,
        reply: 'Please enter a question.',
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    const science = looksLikeScience(userText);
    const educational = isEducationalQuestion(userText);
    const autoVisual = shouldVisualize(userText);
    const contents = buildContents(body, userText);
    const systemInstruction = `${BASE_SYSTEM}\n${BEACONHOUSE_KNOWLEDGE}${science ? '\nFILE SEARCH MODE: Search the supplied Grade 7 science textbook store when available. Use retrieved source material for textbook-specific facts.' : ''}${educational ? '\nEDUCATIONAL FORMAT: Use Keywords, Answer structure, exactly 8 shuffled Key fact words, then a concise Explanation.' : ''}`;

    let responseData = null;
    let usedModel = PRIMARY_MODEL;
    let sourceStatus = science ? (SCIENCE_STORE_NAME ? 'requested' : 'not_configured') : 'not_requested';
    let firstError = null;

    try {
      responseData = await requestGemini({
        apiKey,
        model: PRIMARY_MODEL,
        contents,
        systemInstruction,
        useFileSearch: science && Boolean(SCIENCE_STORE_NAME),
        timeoutMs: science ? SCIENCE_TIMEOUT_MS : NORMAL_TIMEOUT_MS
      });
      if (science && SCIENCE_STORE_NAME) sourceStatus = 'textbook';
    } catch (err) {
      firstError = err;

      // Only retry without File Search for actual tool/request failures.
      // Never chain several model calls for the same question; that was causing the long delays.
      if (science && SCIENCE_STORE_NAME && (err?.name === 'AbortError' || [400,404,408,409].includes(Number(err?.status || 0)) || Number(err?.status || 0) >= 500)) {
        try {
          responseData = await requestGemini({
            apiKey,
            model: PRIMARY_MODEL,
            contents,
            systemInstruction: `${systemInstruction}\nFILE SEARCH NOTICE: Textbook retrieval was unavailable on this attempt. Do not claim that the textbook was retrieved.`,
            useFileSearch: false,
            timeoutMs: 3000
          });
          sourceStatus = 'unavailable_fallback';
        } catch (fallbackErr) {
          firstError = fallbackErr;
        }
      }

      // Only switch model when the primary model ID itself is missing.
      if (!responseData && Number(firstError?.status || 0) === 404 && FALLBACK_MODEL !== PRIMARY_MODEL) {
        try {
          responseData = await requestGemini({
            apiKey,
            model: FALLBACK_MODEL,
            contents,
            systemInstruction,
            useFileSearch: false,
            timeoutMs: 3500
          });
          usedModel = FALLBACK_MODEL;
          sourceStatus = science ? 'unavailable_fallback' : sourceStatus;
        } catch (fallbackModelErr) {
          firstError = fallbackModelErr;
        }
      }
    }

    if (!responseData) {
      const status = Number(firstError?.status || 0);
      const errorCode = firstError?.name === 'AbortError' ? 'MODEL_TIMEOUT'
        : status === 429 ? 'MODEL_RATE_LIMIT'
        : status === 403 ? 'MODEL_PERMISSION_DENIED'
        : status === 404 ? 'MODEL_NOT_FOUND'
        : status === 400 ? 'MODEL_BAD_REQUEST'
        : 'MODEL_REQUEST_FAILED';
      console.error('[Nimbus chat]', requestId, errorCode, status, firstError?.message || 'unknown');
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus is temporarily unavailable. Please try again in a moment.',
        error_code: errorCode,
        provider_status: status || null,
        source_status: sourceStatus,
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    const answer = cleanText(extractGeminiText(responseData));
    if (!answer) {
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus could not produce a response for that question. Please try again.',
        error_code: 'EMPTY_MODEL_RESPONSE',
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    return res.status(200).json({
      ok: true,
      reply: answer,
      auto_visual: autoVisual,
      visual: autoVisual ? createVisualPayload(userText, answer) : null,
      model: body?.model || 'ror',
      backend_model: usedModel,
      source_status: sourceStatus,
      sources: science ? extractSources(responseData) : [],
      limit: DAILY_LIMIT,
      request_id: requestId
    });
  } catch (err) {
    console.error('[Nimbus chat]', requestId, err?.message || err);
    return res.status(200).json({
      ok: false,
      reply: 'Nimbus is temporarily unavailable. Please try again in a moment.',
      error_code: 'CHAT_REQUEST_FAILED',
      auto_visual: false,
      visual: null,
      request_id: requestId
    });
  }
}
