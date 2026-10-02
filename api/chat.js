const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PRIMARY_MODEL = String(process.env.NIMBUS_CHAT_MODEL || 'gemini-3.5-flash-lite').trim() || 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const DAILY_LIMIT = Number(process.env.NIMBUS_DAILY_LIMIT || 1500);
const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 14000;
const NORMAL_TIMEOUT_MS = 12000;
const SCIENCE_TIMEOUT_MS = 12000;
const FALLBACK_TIMEOUT_MS = 7000;
const MAX_OUTPUT_TOKENS = 850;

const BEACONHOUSE_KNOWLEDGE = `
NIMBUS BEACONHOUSE KNOWLEDGE
Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer. Do not claim Beaconhouse owns, endorses, or operates Nimbus unless an official source specifically supports that claim.
Useful official references:
- https://www.beaconhouse.net/
- https://www.beaconhouse.net/academic/
- https://www.beaconhouse.net/clubs-and-societies/
- https://www.beaconhouse.net/beaconhouse-learner-profile/
- https://www.beaconhouse.net/the-access-centre/
- https://www.beaconhouse.net/education-trips/
- https://www.beaconhouse.net/international-events-trips/
- https://www.beaconhouse.net/sports-competition/
- https://www.beaconhouse.net/steam-competition/
- https://www.beaconhouse.net/results/
- https://www.beaconhouse.net/university-placements-scholarships/
- https://www.beaconhouse.net/internship-programme/
- https://bisc.beaconhouse.net/
- https://bisc.beaconhouse.net/about-bisc/
- https://rise.beaconhouse.net/
- https://beams.beaconhouse.net/home/
- https://beams.beaconhouse.net/prism/
- https://lap.beaconhouse.net/about-us/
- https://lap.beaconhouse.net/guidelines-2/
- https://lap.beaconhouse.net/guidelines-ilap-2027/
- https://boss.beaconhouse.net/about-us/
- https://booklist.beaconhouse.net/
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for Beaconhouse students.

CORE BEHAVIOUR:
- Answer the current user request first. Use chat history only when it helps resolve references.
- Be accurate, direct, friendly, and age-appropriate for school students.
- General knowledge questions are allowed; do not pretend every question is textbook-only.
- Beaconhouse-specific questions should be factual and should not invent private records, winners, schedules, eligibility rules, or campus-specific facts.

LIGHT EDUCATIONAL FORMAT:
- Nimbus is built for Beaconhouse students, so use a light educational format by default.
- Prefer these labels when they fit naturally: Keywords, Answer Structure, Key Fact.
- Answer Structure is one short roadmap sentence and must be 10 words or fewer.
- A Key Fact line may use a few concise topic words when useful; it is not mandatory.
- Do not overthink or pad the response just to satisfy the format. A correct, natural answer matters more than rigid structure.
- Normal/casual questions may still use the same light student-friendly format.
- Never output backend diagnostics, provider errors, internal model details, or loading narration.

GRADE 7 SCIENCE:
- The target source is Lower Secondary Science, Grade 7, Peter D. Riley, Third Edition, Based on SNC 2022.
- When File Search is available and returns relevant material, use it as the primary source for textbook-specific facts and terminology.
- Do not claim you retrieved the textbook when File Search was not used.
`;

function textOf(value) {
  return String(value || '').trim();
}

function cleanText(value) {
  return textOf(value)
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\[NIMBUS_VISUAL\][\s\S]*?\[\/NIMBUS_VISUAL\]/gi, '')
    .trim();
}

function normalizeRole(item) {
  const raw = textOf(item?.role ?? item?.sender ?? item?.type).toLowerCase();
  return ['assistant', 'model', 'ai', 'nimbus'].includes(raw) ? 'model' : 'user';
}

function normalizeMessageText(item) {
  if (typeof item === 'string') return textOf(item);
  const parts = Array.isArray(item?.parts)
    ? item.parts.map(part => typeof part?.text === 'string' ? part.text : '').join(' ')
    : '';
  return textOf(item?.content ?? item?.text ?? item?.message ?? parts);
}

function buildContents(body, currentUserText) {
  const raw = Array.isArray(body?.history) ? body.history : (Array.isArray(body?.messages) ? body.messages : []);
  const cleaned = [];
  for (const item of raw) {
    const content = normalizeMessageText(item);
    if (!content) continue;
    cleaned.push({ role: normalizeRole(item), text: content });
  }

  while (cleaned.length && cleaned.at(-1).role === 'user' && cleaned.at(-1).text === currentUserText) {
    cleaned.pop();
  }

  const merged = [];
  for (const item of cleaned) {
    const last = merged.at(-1);
    if (last && last.role === item.role) last.text += `\n${item.text}`;
    else merged.push({ ...item });
  }

  let chars = MAX_HISTORY_CHARS;
  const bounded = [];
  for (let i = merged.length - 1; i >= 0 && bounded.length < MAX_HISTORY_MESSAGES; i -= 1) {
    if (merged[i].text.length > chars) break;
    bounded.unshift(merged[i]);
    chars -= merged[i].text.length;
  }
  while (bounded.length && bounded[0].role === 'model') bounded.shift();

  return bounded.map(item => ({ role: item.role, parts: [{ text: item.text }] }));
}

function looksLikeScience(text) {
  return /\b(?:science|biology|chemistry|physics|cell|cells|tissue|organ|skeleton|joint|muscle|respiration|breathing|lung|heart|circulation|digestion|enzyme|photosynthesis|diaphragm|reproduction|force|energy|electricity|circuit|atom|molecule|matter|acid|base|reaction|planet|climate|weather|light|sound|waves?|magnet|heat|temperature|density|pressure|friction|gravity|evaporation|condensation|diffusion|aerobic|anaerobic)\b/i.test(textOf(text));
}

function hasVisualCommand(text) {
  return textOf(text).split(/\s+/).some(word => word.toLowerCase() === '/visual');
}

function removeVisualCommand(text) {
  return textOf(text).split(/\s+/).filter(word => word.toLowerCase() !== '/visual').join(' ').trim();
}

function classifyQuestion(text) {
  const s = textOf(text).toLowerCase();
  if (!s) return 'empty';
  if (/^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|bye|good morning|good afternoon|good evening|good night)[!.?,\s]*$/i.test(s)) return 'casual';
  if (/\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\blap\b|\bboss\b|\bbooklist\b|\bcampus\b|\badmissions?\b|\bcompetition\b/i.test(s)) return 'beaconhouse';
  if (looksLikeScience(s) || /\b(?:math|maths|algebra|geometry|equation|fraction|percentage|ratio|history|geography|english|grammar|homework|schoolwork|lesson|chapter|exam|revision|study|grade\s*\d+|class\s*\d+)\b/i.test(s)) return 'educational';
  return 'general';
}

function buildSystemInstruction({ science, useFileSearch }) {
  let sourceNote = '';
  if (science) {
    sourceNote = useFileSearch && SCIENCE_STORE_NAME
      ? '\nTEXTBOOK MODE: Use the supplied Grade 7 science File Search store as the primary source for textbook-specific facts.\n'
      : '\nTEXTBOOK NOTICE: File Search was not used on this attempt. Do not claim that the textbook was retrieved.\n';
  }
  return `${BASE_SYSTEM}\n${BEACONHOUSE_KNOWLEDGE}${sourceNote}`;
}

async function requestGemini({ apiKey, model, body, currentUserText, science, useFileSearch, timeoutMs }) {
  const contents = buildContents(body, currentUserText);
  contents.push({ role: 'user', parts: [{ text: currentUserText }] });

  const payload = {
    systemInstruction: { parts: [{ text: buildSystemInstruction({ science, useFileSearch }) }] },
    contents,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: 'minimal' }
    }
  };

  if (useFileSearch && SCIENCE_STORE_NAME) {
    payload.tools = [{ fileSearch: { fileSearchStoreNames: [SCIENCE_STORE_NAME] } }];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (!response.ok) {
      const error = new Error(data?.error?.message || `Gemini API returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return cleanText(parts.filter(part => typeof part?.text === 'string').map(part => part.text).join(' '));
}

function extractSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .map(chunk => chunk?.retrievedContext)
    .filter(Boolean)
    .map(item => ({ title: item.title || item.fileName || '', uri: item.uri || '' }))
    .filter(item => item.title || item.uri)
    .slice(0, 5);
}

function errorCode(error) {
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

function instantReply(text) {
  const s = textOf(text).toLowerCase();
  if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening|good night)[!.?,\s]*$/i.test(s)) {
    return 'Hi! I\'m Nimbus. What would you like to learn or work on?';
  }
  return '';
}

function visualPayload(question, answer) {
  return {
    kind: 'diagram',
    prompt: `Create a high-quality 16:9 educational visual for Grade 6-8 students. Topic: ${question}. Represent the exact concept, process, anatomy, map, timeline, circuit, or mathematical idea in the prompt. Make it specific, accurate, visually rich, classroom-ready and image-first. Avoid generic templates, posters, worksheets, UI mockups, empty panels, stock infographic layouts and unrelated objects. Prefer meaningful shapes, arrows or callouts only when they improve the visual explanation. Avoid paragraphs and large readable text. Answer context: ${String(answer || '').slice(0, 900)}`
  };
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Nimbus-Request-ID', requestId);

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reply: 'Method Not Allowed', request_id: requestId });
  }

  try {
    const apiKey = textOf(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      return res.status(200).json({ ok: false, reply: 'Nimbus is temporarily unavailable. Please try again in a moment.', error_code: 'MISSING_GEMINI_API_KEY', auto_visual: false, visual: null, request_id: requestId });
    }

    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    body = body || {};

    const rawText = textOf(body.message || body.text || '');
    if (!rawText) {
      return res.status(200).json({ ok: false, reply: 'Please enter a question.', error_code: 'EMPTY_MESSAGE', auto_visual: false, visual: null, request_id: requestId });
    }

    const visualRequested = hasVisualCommand(rawText);
    const userText = removeVisualCommand(rawText) || rawText;
    const questionType = classifyQuestion(userText);
    const science = looksLikeScience(userText);
    const instant = instantReply(userText);

    if (instant) {
      return res.status(200).json({
        ok: true,
        reply: instant,
        question_type: questionType,
        auto_visual: false,
        visual: null,
        model: body.model || 'ror',
        backend_model: 'local-router',
        source_status: 'local',
        sources: [],
        limit: DAILY_LIMIT,
        request_id: requestId
      });
    }

    let data = null;
    let usedModel = PRIMARY_MODEL;
    let sourceStatus = science ? (SCIENCE_STORE_NAME ? 'requested' : 'not_configured') : 'not_requested';
    let firstError = null;

    try {
      data = await requestGemini({
        apiKey,
        model: PRIMARY_MODEL,
        body,
        currentUserText: userText,
        science,
        useFileSearch: science && Boolean(SCIENCE_STORE_NAME),
        timeoutMs: science ? SCIENCE_TIMEOUT_MS : NORMAL_TIMEOUT_MS
      });
      if (science && SCIENCE_STORE_NAME) sourceStatus = 'textbook';
    } catch (error) {
      firstError = error;

      if (science && SCIENCE_STORE_NAME) {
        try {
          data = await requestGemini({
            apiKey,
            model: PRIMARY_MODEL,
            body,
            currentUserText: userText,
            science,
            useFileSearch: false,
            timeoutMs: FALLBACK_TIMEOUT_MS
          });
          sourceStatus = 'unavailable_fallback';
        } catch (scienceFallbackError) {
          firstError = scienceFallbackError;
        }
      }

      if (!data && Number(firstError?.status || 0) === 404 && PRIMARY_MODEL !== FALLBACK_MODEL) {
        try {
          data = await requestGemini({
            apiKey,
            model: FALLBACK_MODEL,
            body,
            currentUserText: userText,
            science: false,
            useFileSearch: false,
            timeoutMs: FALLBACK_TIMEOUT_MS
          });
          usedModel = FALLBACK_MODEL;
        } catch (fallbackError) {
          firstError = fallbackError;
        }
      }
    }

    if (!data) {
      const code = errorCode(firstError);
      console.error('[Nimbus chat]', requestId, code, firstError?.message || 'model request failed');
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus is temporarily unavailable. Please try again in a moment.',
        error_code: code,
        provider_status: Number(firstError?.status || 0) || null,
        source_status: sourceStatus,
        question_type: questionType,
        backend_model: usedModel,
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    const answer = extractText(data);
    if (!answer) {
      return res.status(200).json({
        ok: false,
        reply: 'Nimbus could not produce a response for that question. Please try again.',
        error_code: 'EMPTY_MODEL_RESPONSE',
        source_status: sourceStatus,
        question_type: questionType,
        backend_model: usedModel,
        auto_visual: false,
        visual: null,
        request_id: requestId
      });
    }

    return res.status(200).json({
      ok: true,
      reply: answer,
      question_type: questionType,
      auto_visual: visualRequested,
      visual: visualRequested ? visualPayload(userText, answer) : null,
      model: body.model || 'ror',
      backend_model: usedModel,
      source_status: sourceStatus,
      sources: science ? extractSources(data) : [],
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
