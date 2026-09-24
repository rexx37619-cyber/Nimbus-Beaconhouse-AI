const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'openrouter/free';
const DEFAULT_CHAT_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_CHAT_MODEL = 'gemini-3.1-flash-lite';
const FINAL_CHAT_MODEL = 'gemini-3.8-flash';
const CHAT_MODEL = String(process.env.NIMBUS_CHAT_MODEL || DEFAULT_CHAT_MODEL).trim() || DEFAULT_CHAT_MODEL;
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const HISTORY_STORE_NAME = String(process.env.NIMBUS_HISTORY_STORE || '').trim();

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 14000;
const NORMAL_TIMEOUT_MS = 7000;
const SCIENCE_TIMEOUT_MS = 9000;
const SCIENCE_FALLBACK_TIMEOUT_MS = 18000;
const MAX_OUTPUT_TOKENS = 750;

const BEACONHOUSE_KNOWLEDGE = `
BEACONHOUSE PUBLIC KNOWLEDGE â€” CURATED REFERENCES
Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer. Do not claim Beaconhouse owns, endorses, or operates Nimbus unless an official source specifically supports that claim.
Useful official references:
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
- Official book lists: https://booklist.beaconhouse.net/
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for students.

CURRENT TURN:
- Answer the CURRENT user message first.
- Never copy or recycle an earlier answer as the answer to a different current request.
- Use active-chat history only when it is necessary to resolve references such as "it", "this", or "the previous example".

NORMAL CHAT:
- Greetings and casual chat get a natural short answer.
- Beaconhouse questions get factual Beaconhouse-focused answers.
- Never automatically add a science visual just because a Beaconhouse question contains words like class, competition, science, book, or program.

EDUCATIONAL FORMAT:
For an educational/schoolwork question, use exactly these sections when possible:
Keywords: 5â€“10 concise topic terms.
Answer structure: 2â€“5 short steps or points the student can use to construct an answer.
Key fact (8 shuffled words): exactly 8 separate topic-relevant words, shuffled/varied in order, not a sentence.
Do not produce a polished ready-to-submit essay for ordinary schoolwork.

GRADE 7 SCIENCE:
- The supplied source is Lower Secondary Science, Grade 7, Peter D. Riley, Third Edition, Based on SNC 2022.
- When File Search is available and returns relevant material, use it as the primary source for textbook-specific facts and terminology.
- Paraphrase rather than copying long passages.
- You may add a small amount of general educational context when it helps understanding, but do not invent textbook-specific facts or contradict the retrieved source.

BEACONHOUSE:
- A Beaconhouse question is not a science-visual question.
- Do not invent current schedules, winners, eligibility rules, private records, or exact campus-specific book lists.
- A URL is a reference, not proof that its page was retrieved.

STYLE:
- Direct, helpful, student-friendly.
- No backend diagnostics, provider names, loading narration, or error dumps.
- Do not use Markdown # headings or **bold** markers.
`;

function cleanText(value) {
  return String(value || '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[NIMBUS_VISUAL\][\s\S]*?\[\/NIMBUS_VISUAL\]/gi, '')
    .trim();
}

function normalizeRole(item) {
  const raw = String(item?.role ?? item?.sender ?? item?.type ?? (item?.isUser === true ? 'user' : '')).toLowerCase().trim();
  return ['assistant', 'model', 'ai', 'nimbus'].includes(raw) ? 'model' : 'user';
}

function normalizeMessageText(item) {
  if (typeof item === 'string') return item.trim();
  const partText = Array.isArray(item?.parts)
    ? item.parts.map(p => typeof p?.text === 'string' ? p.text : '').join(' ')
    : '';
  return String(item?.content ?? item?.text ?? item?.message ?? partText ?? '').trim();
}

function buildHistory(body, currentUserText) {
  const rawHistory = Array.isArray(body?.history) ? body.history : (Array.isArray(body?.messages) ? body.messages : []);
  const cleaned = [];

  for (const item of rawHistory) {
    const text = normalizeMessageText(item);
    if (!text) continue;
    cleaned.push({ role: normalizeRole(item), text });
  }

  while (cleaned.length && cleaned.at(-1).role === 'user' && cleaned.at(-1).text === currentUserText) {
    cleaned.pop();
  }

  // Keep the turn sequence intact. Only repair consecutive duplicate roles by
  // combining them with a clear separator instead of inventing a missing turn.
  const merged = [];
  for (const item of cleaned) {
    const last = merged.at(-1);
    if (last && last.role === item.role) {
      last.text += `\n${item.text}`;
    } else {
      merged.push({ ...item });
    }
  }

  let remainingChars = MAX_HISTORY_CHARS;
  const bounded = [];
  for (let i = merged.length - 1; i >= 0 && bounded.length < MAX_HISTORY_MESSAGES; i -= 1) {
    const item = merged[i];
    if (item.text.length > remainingChars) break;
    bounded.unshift(item);
    remainingChars -= item.text.length;
  }

  while (bounded.length && bounded[0].role === 'model') bounded.shift();

  return bounded.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
}

function buildContents(body, currentUserText) {
  const contents = buildHistory(body, currentUserText);
  contents.push({ role: 'user', parts: [{ text: currentUserText }] });
  return contents;
}

function isCasualMessage(text) {
  return /^(?:hi|hi nimbus|hello|hello nimbus|hey|hey nimbus|yo|sup|what'?s up|how are you|how are u|good morning|good afternoon|good evening|good night|thanks|thank you|thx|ok|okay|k|bye|goodbye|who are you|what can you do|tell me a joke)[!.?\s]*$/i.test(String(text || '').trim());
}

function getInstantLocalReply(text) {
  const s = String(text || '').trim().toLowerCase();

  if (/^(?:who are you|who is this|what is nimbus|what's nimbus|what is this)[?.! ]*$/i.test(s)) {
    return "I'm Nimbus, a student-focused educational AI assistant.";
  }

  if (
    /^(?:who is the founder|who's the founder|who founded nimbus|who created nimbus|who made nimbus|who is nimbus'?s founder)[?.! ]*$/i.test(s) ||
    /\b(?:founder|created|founded|made)\b.*\bnimbus\b/i.test(s)
  ) {
    return "Nimbus was founded and developed by Abdul Haadi Hassan.";
  }

  if (/^(?:what can you do|what do you do|what are you capable of)[?.! ]*$/i.test(s)) {
    return "I help with schoolwork, explanations, revision, science questions, Beaconhouse information, and educational visuals.";
  }

  if (/^(?:what powers nimbus|what model powers nimbus|what model do you use)[?.! ]*$/i.test(s)) {
    return "Nimbus is powered by a Google model with custom Nimbus modifications.";
  }

  if (/^(?:are you official beaconhouse|is nimbus official beaconhouse|are you owned by beaconhouse)[?.! ]*$/i.test(s)) {
    return "Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer. It is not presented as an official Beaconhouse product.";
  }

  return null;
}

function isBeaconhouseQuestion(text) {
  const s = String(text || '').toLowerCase();
  return /\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\blap\b|\bboss\b|\bbook\s*list\b|\bbooklist\b|\bcampus\b|\badmissions?\b|\bcompetition\b|\blearner\s+profile\b|\baccess\s+centre\b|\bclubs?\s+(?:and|&)\s+societies\b/i.test(s);
}

function looksLikeScience(text) {
  return /\b(?:science|biology|chemistry|physics|ecosystem(?:s)?|food\s+chain|water\s+cycle|carbon\s+cycle|nitrogen\s+cycle|food\s+web|habitat(?:s)?|adaptation(?:s)?|cell(?:s)?|tissue(?:s)?|organ(?:s)?|skeleton(?:s)?|joint(?:s)?|muscle(?:s)?|respiration|breathing|lung(?:s)?|heart|circulation|digestion|enzyme(?:s)?|photosynthesis|diaphragm|reproduction|force(?:s)?|energy|electricity|circuit(?:s)?|atom(?:s)?|molecule(?:s)?|matter|acid(?:s)?|base(?:s)?|reaction(?:s)?|planet(?:s)?|solar\s+system|rock(?:s)?|fossil(?:s)?|climate|weather|light|sound|wave(?:s)?|magnet(?:s)?|heat|temperature|density|pressure|friction|gravity|evaporation|condensation|diffusion|aerobic|anaerobic)\b/i.test(String(text || ''));
}

function hasAcademicSubject(text) {
  return /\b(?:math|maths|algebra|arithmetic|geometry|equation(?:s)?|fraction(?:s)?|percentage(?:s)?|ratio(?:s)?|statistics|probability|mean|median|mode|english|grammar|writing|literature|poetry|reading|noun(?:s)?|verb(?:s)?|adjective(?:s)?|adverb(?:s)?|sentence(?:s)?|paragraph(?:s)?|history|geography|civics|map(?:s)?|culture|civilization|revolution|empire|timeline|computer\s+science|ict|coding|programming|algorithm(?:s)?|biology|chemistry|physics|science|homework|schoolwork|exam|revision|lesson|chapter|class\s*\d+|grade\s*\d+)\b/i.test(String(text || ''));
}

function looksLikeMathProblem(text) {
  const s = String(text || '');
  return /(?:\d|x|y)\s*(?:[+\-*/^=]|Ã·|Ã—)|\b(?:solve|calculate|find|evaluate|simplify|factorise|factorize|expand)\b/i.test(s);
}

function hasEducationalIntent(text) {
  return /\b(?:explain|explanation|describe|define|definition|what\s+is|what\s+are|what\s+does|what\s+do|how\s+does|how\s+do|why\s+does|why\s+do|difference\s+between|compare|comparison|function\s+of|purpose\s+of|types?\s+of|how\s+it\s+works?|tell\s+me\s+about|teach\s+me|learn\s+about|lesson|concept|process|steps?|sequence|example|diagram|label(?:led)?|flowchart|solve|calculate|find|prove|derive|revise|revision|study|notes)\b/i.test(String(text || ''));
}

function isHistoryQuestion(text) {
  const s = String(text || '').toLowerCase();
  return /\b(?:history|historical|medieval|civilization|civilisation|europe|asia\s+minor|seljuk|fatimid|ottoman|byzantine|crusade|caliphate|islamic|empire|dynasty|feudal|renaissance|monarch|kingdom|charlemagne|roman|greek|muslim)\b/i.test(s);
}

function isEducationalQuestion(text) {
  const s = String(text || '').trim();
  if (!s || isCasualMessage(s) || isBeaconhouseQuestion(s)) return false;
  const academicContext = hasAcademicSubject(s) || looksLikeScience(s) || looksLikeMathProblem(s) || /\b(?:school|student|classroom|homework|schoolwork|exam|lesson|chapter|revision|study|notes|subject)\b/i.test(s);
  return hasEducationalIntent(s) && academicContext;
}

function explicitVisualRequest(text) {
  return /\b(?:show|draw|visuali[sz]e|illustrate|illustration|diagram|label(?:led)?|picture|image|chart|flowchart|model)\b/i.test(String(text || ''));
}

function shouldVisualize(text) {
  const s = String(text || '').trim();
  if (!s || isCasualMessage(s) || isBeaconhouseQuestion(s)) return false;
  // Educational questions trigger a visual automatically. Explicit visual
  // requests trigger only when the request itself has an academic context.
  if (isEducationalQuestion(s)) return true;
  return explicitVisualRequest(s) && (hasAcademicSubject(s) || looksLikeScience(s) || /\b(?:school|student|classroom|homework|schoolwork|lesson|grade\s*\d+|class\s*\d+)\b/i.test(s));
}

function classifyVisualKind(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(joints?|skeleton|bones?|muscles?|lungs?|heart|cells?|tissues?|organs?|brain|digestion|respiration|breathing|reproduction|kidneys?|stomach|intestines?|diaphragm)\b/.test(s)) return 'a scientifically accurate labelled anatomical or biological illustration';
  if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food\s+chain|food\s+web|ecosystem|cycle|heat|temperature|diffusion|aerobic|anaerobic)\b/.test(s)) return 'a scientifically accurate scientific-system or process illustration';
  if (/\b(algebra|equation|fraction|geometry|ratio|percentage|probability|statistics)\b/.test(s)) return 'a clear educational mathematics visualization';
  if (/\b(history|geography|map|climate|civilization|empire|timeline)\b/.test(s)) return 'a clear educational history or geography visualization';
  return 'a polished educational illustration that directly represents the concept';
}

function stableHash(text) {
  let hash = 2166136261;
  for (const char of String(text || '').toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createVisualPayload(question, answer) {
  const kind = classifyVisualKind(question);
  return {
    id: `nimbus-visual-${stableHash(question)}`,
    type: 'diagram',
    title: String(question).slice(0, 90),
    prompt: `Create a high-quality 16:9 ${kind} for a school lesson.\nTopic/question: ${String(question).trim()}\nUseful educational answer points: ${String(answer || '').slice(0, 1100)}\nRequirements: topic-specific, accurate, classroom-ready, visually rich, strong focal subject, meaningful relationships, concise readable labels, useful arrows/callouts only when they clarify the concept. Prefer an actual anatomy illustration, process diagram, scientific visualization, map, timeline, or mathematics visualization appropriate to the subject. Do NOT make a generic four-box diagram, text-only poster, wireframe, empty placeholder, generic card grid, or repeated stock template. Do not invent unsupported facts or structures.`
  };
}

function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter(p => typeof p?.text === 'string').map(p => p.text).join(' ').trim();
}

function extractSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.map(chunk => chunk?.retrievedContext).filter(Boolean).map(item => ({
    title: item.title || item.fileName || '',
    uri: item.uri || ''
  })).filter(item => item.title || item.uri).slice(0, 5);
}

function stripBullet(text) {
  return String(text || '').replace(/^\s*[-*â€¢]\s*/gm, '').trim();
}

function pickEightWords(answer, question) {
  const stop = new Set('the a an and or of to in on for with is are was were be been being this that these those how what why does do did it its their our your from by as at into about than then can could should would may might will shall you your student students explain explanation function purpose main very more less also'.split(/\s+/));
  const source = `${answer} ${question}`.replace(/https?:\/\/\S+/g, ' ');
  const candidates = source.match(/[A-Za-z][A-Za-z-]*/g) || [];
  const words = [];
  for (const raw of candidates) {
    const w = raw.toLowerCase().replace(/^-+|-+$/g, '');
    if (w.length < 3 || stop.has(w)) continue;
    if (!words.includes(w)) words.push(w);
    if (words.length >= 8) break;
  }
  const fallback = ['structure', 'function', 'process', 'movement', 'system', 'change', 'control', 'important'];
  for (const w of fallback) {
    if (words.length >= 8) break;
    if (!words.includes(w)) words.push(w);
  }
  return words.slice(0, 8);
}

function enforceEducationalFormat(answer, question) {
  let text = stripBullet(cleanText(answer));
  if (!/\bKeywords\s*:/i.test(text)) {
    text = `Keywords: ${pickEightWords(text, question).slice(0, 6).join(', ')}\n\n${text}`;
  }
  if (!/\bAnswer structure\s*:/i.test(text)) {
    text = text.replace(/(Keywords:[^\n]*(?:\n|$))/, '$1\nAnswer structure: identify the concept, state the main function or idea, explain the key relationship or steps, and give one useful example.\n\n');
  }
  const eight = pickEightWords(text, question);
  const withoutOld = text.replace(/Key fact\s*\(8\s*shuffled\s*words\)\s*:[^\n]*/i, '').trim();
  const explanationIndex = withoutOld.search(/\bExplanation\s*:/i);
  const head = explanationIndex >= 0 ? withoutOld.slice(0, explanationIndex).trim() : withoutOld;
  return `${head}\n\nKey fact (8 shuffled words): ${eight.join(' ')}`.trim();
}

function buildSystemInstruction({ science, educational, sourceMode = false, beaconhouse = false, history = false }) {
  let extra = '';
  if (educational) {
    extra += '\nEDUCATIONAL OUTPUT ENFORCEMENT: Include Keywords, Answer structure, and Key fact (8 shuffled words). The key-fact line must contain exactly eight separate words.\n';
  }
  if (science) {
    extra += sourceMode
      ? '\nTEXTBOOK MODE: Use the supplied Grade 7 science File Search store as the primary source for textbook-specific facts.\n'
      : '\nTEXTBOOK NOTICE: File Search was unavailable on this attempt. Do not claim you retrieved the textbook.\n';
  }

  if (history) {
    extra += sourceMode
      ? '\nHISTORY BOOK MODE: Use the supplied Grade 7 History File Search store as the primary source for textbook-specific facts and terminology.\n'
      : '\nHISTORY BOOK NOTICE: History File Search was unavailable on this attempt. Do not claim you retrieved the History book.\n';
  }
  const knowledge = beaconhouse ? BEACONHOUSE_KNOWLEDGE : '';
  const memory = '\nCONVERSATION MEMORY: Use the supplied conversation history to stay familiar with this chat. When the user refers to earlier messages, answer using the relevant earlier context. Do not confuse information from another conversation with the current chat.';
  return `${BASE_SYSTEM}\n${knowledge}${extra}${memory}`;
}

async function requestGemini({ apiKey, model, body, currentUserText, science, educational, history = false, useFileSearch, timeoutMs, beaconhouse = false }) {
  const generationConfig = {
    maxOutputTokens: MAX_OUTPUT_TOKENS
  };

  // Gemini 3 Flash-Lite supports thinkingLevel.
  // Gemini 2.5 Flash-Lite uses the older thinking configuration, so omit
  // thinkingLevel entirely for that fallback to avoid a schema mismatch.
  if (model !== 'gemini-2.5-flash-lite') {
    generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
  }

  const payload = {
    systemInstruction: {
      parts: [{
        text: buildSystemInstruction({
          science,
          educational,
          sourceMode: useFileSearch,
          beaconhouse,
          history
        })
      }]
    },
    contents: buildContents(body, currentUserText),
    generationConfig
  };

  if (useFileSearch) {
    const storeName = science ? SCIENCE_STORE_NAME : (history ? HISTORY_STORE_NAME : '');
    if (storeName) {
      payload.tools = [{
        fileSearch: {
          fileSearchStoreNames: [storeName]
        }
      }];
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data?.error?.message || `Gemini API returned HTTP ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestOpenRouter({ apiKey, body, currentUserText, science, educational, history, beaconhouse }) {
  const systemText = buildSystemInstruction({
    science,
    educational,
    sourceMode: false,
    beaconhouse,
    history
  });

  const contents = buildContents(body, currentUserText);

  const messages = [
    { role: 'system', content: systemText }
  ];

  for (const item of contents) {
    const role = item.role === 'model' ? 'assistant' : 'user';
    const textParts = (item.parts || [])
      .filter(part => typeof part?.text === 'string')
      .map(part => part.text);

    const content = textParts.join('\n').trim();
    if (content) {
      messages.push({ role, content });
    }
  }

  const response = await fetch(OPENROUTER_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://nimbus-beaconhouse-ai.vercel.app/',
      'X-Title': 'Nimbus Beaconhouse AI'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS
    })
  });

  const raw = await response.text();

  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `OpenRouter API returned HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function errorCodeFrom(error) {
  if (!error) return 'MODEL_REQUEST_FAILED';
  if (error.name === 'AbortError') return 'MODEL_TIMEOUT';
  const status = Number(error.status || 0);
  if (status === 400) return 'MODEL_BAD_REQUEST';
  if (status === 401) return 'MODEL_UNAUTHORIZED';
  if (status === 403) return 'MODEL_PERMISSION_DENIED';
  if (status === 404) return 'MODEL_NOT_FOUND';
  if (status === 429) return 'MODEL_RATE_LIMIT';
  if (status >= 500) return 'MODEL_SERVER_ERROR';
  return 'MODEL_REQUEST_FAILED';
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
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    body = body || {};

    const userText = String(body.message || '').trim();
    if (!userText) {
      return res.status(200).json({ ok: false, reply: 'Please enter a question.', auto_visual: false, visual: null, request_id: requestId });
    }

    const instantReply = getInstantLocalReply(userText);

    if (instantReply) {
      return res.status(200).json({
        ok: true,
        reply: instantReply,
        auto_visual: false,
        visual: null,
        model: body.model || 'ror',
        backend_model: 'local-router',
        source_status: 'not_requested',
        sources: [],
        limit: DAILY_LIMIT,
        request_id: requestId
      });
    }

    if (isCasualMessage(userText)) {
      return res.status(200).json({
        ok: true,
        reply: "Hey! 👋 I'm Nimbus. What are we learning today?",
        auto_visual: false,
        visual: null,
        model: body.model || 'ror',
        backend_model: 'local-casual',
        source_status: 'not_requested',
        sources: [],
        limit: DAILY_LIMIT,
        request_id: requestId
      });
    }

    const science = looksLikeScience(userText);
    const history = isHistoryQuestion(userText) && !isBeaconhouseQuestion(userText);
    const educational = isEducationalQuestion(userText);
    const autoVisual = shouldVisualize(userText);
    const beaconhouse = isBeaconhouseQuestion(userText);

    let sourceStatus = science
      ? (SCIENCE_STORE_NAME ? 'requested' : 'not_configured')
      : history
        ? (HISTORY_STORE_NAME ? 'requested' : 'not_configured')
        : 'not_requested';

    let responseData = null;
    let usedModel = CHAT_MODEL;
    let firstError = null;

    const modelChain = [CHAT_MODEL, FALLBACK_CHAT_MODEL, FINAL_CHAT_MODEL]
      .filter(Boolean)
      .filter((model, index, arr) => arr.indexOf(model) === index);

    outer:
    for (let modelIndex = 0; modelIndex < modelChain.length; modelIndex++) {
      const model = modelChain[modelIndex];

      // Textbook retrieval is attempted only on the primary model.
      // If that path is unavailable, the fallback can still answer the question.
      const useFileSearch =
        (science || history) &&
        modelIndex === 0 &&
        Boolean(science ? SCIENCE_STORE_NAME : HISTORY_STORE_NAME);

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          responseData = await requestGemini({
            apiKey,
            model,
            body,
            currentUserText: userText,
            science,
            educational,
            history,
            useFileSearch,
            timeoutMs: science ? SCIENCE_TIMEOUT_MS : NORMAL_TIMEOUT_MS,
            beaconhouse
          });

          usedModel = model;

          if (science && useFileSearch) {
            sourceStatus = 'textbook';
          } else if (history && useFileSearch) {
            sourceStatus = 'historybook';
          } else if ((science || history) && modelIndex > 0) {
            sourceStatus = 'unavailable_fallback';
          }

          break outer;
        } catch (error) {
          firstError = error;

          const status = Number(error?.status || 0);
          const retryable =
            error?.name === 'AbortError' ||
            status === 408 ||
            status === 429 ||
            status >= 500;

          if (!retryable || attempt === 1) {
            break;
          }

          // Small delay, matching the proven Netlify behavior.
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
    }

    if (!responseData) {
      const openRouterKey = String(process.env.NIMBUS_OPENROUTER_API_KEY || '').trim();

      if (openRouterKey) {
        try {
          const openRouterData = await requestOpenRouter({
            apiKey: openRouterKey,
            body,
            currentUserText: userText,
            science,
            educational,
            history,
            beaconhouse
          });

          const openRouterReply =
            openRouterData?.choices?.[0]?.message?.content ||
            openRouterData?.choices?.[0]?.text ||
            '';

          if (String(openRouterReply).trim()) {
            responseData = {
              candidates: [{
                content: {
                  parts: [{ text: String(openRouterReply) }]
                }
              }]
            };
            usedModel = 'openrouter/free';
            sourceStatus =
              (science || history)
                ? 'unavailable_fallback'
                : sourceStatus;
          }
        } catch (openRouterError) {
          firstError = openRouterError;
          console.error(
            '[Nimbus OpenRouter]',
            requestId,
            Number(openRouterError?.status || 0),
            openRouterError?.message || 'unknown'
          );
        }
      }
    }

    if (!responseData) {
      const code = errorCodeFrom(firstError);
      console.error('[Nimbus chat]', requestId, code, Number(firstError?.status || 0), firstError?.message || 'unknown');
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus is temporarily unavailable. Please try again in a moment.',
        error_code: code,
        provider_status: Number(firstError?.status || 0) || null,
        source_status: sourceStatus,
        backend_model: usedModel,
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    let answer = extractGeminiText(responseData);
    if (!answer) {
      console.error('[Nimbus chat]', requestId, 'EMPTY_MODEL_RESPONSE');
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus could not produce a response for that question. Please try again.',
        error_code: 'EMPTY_MODEL_RESPONSE',
        source_status: sourceStatus,
        backend_model: usedModel,
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    answer = educational ? enforceEducationalFormat(answer, userText) : cleanText(answer);

    return res.status(200).json({
      ok: true,
      reply: answer,
      auto_visual: autoVisual,
      visual: autoVisual ? createVisualPayload(userText, answer) : null,
      model: body.model || 'ror',
      backend_model: usedModel,
      source_status: sourceStatus,
      sources: science ? extractSources(responseData) : [],
      limit: DAILY_LIMIT,
      request_id: requestId
    });
  } catch (error) {
    console.error('[Nimbus chat]', requestId, error?.message || error);
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
