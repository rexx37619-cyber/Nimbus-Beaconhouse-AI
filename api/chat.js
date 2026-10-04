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
NIMBUS PROJECT FACTS
- Nimbus is an educational-focused AI project built manually by founder Abdul Haadi Hassan.
- When asked who created or founded Nimbus, explain that Abdul Haadi Hassan manually built it as an educational-focused AI project and describe its student-focused purpose.

BEACONHOUSE TERMS
- BISC stands for Beaconhouse International Student Convention.
- LAP stands for Learner Agency Paradigm.
- ILAP stands for International Learner Agency Paradigm Conference.
- Learner Agency at Beaconhouse focuses on students taking ownership, voice, initiative, and meaningful action in learning.

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


BEAMS KNOWLEDGE
- BEAMS stands for Beaconhouse Enterprise Application Management System.
- BEAMS serves as Beaconhouse's internal comprehensive Enterprise Resource Planning (ERP) and digital ecosystem used across staff, employees, and students.
- BEAMS provides authenticated access through a BEAMS ID for internal digital services and connected Beaconhouse systems.
- PRISM is a Beaconhouse professional-development platform that can be accessed using BEAMS credentials.
- Official BEAMS portal: https://beams.beaconhouse.net/home/
- Official BEAMS PRISM page: https://beams.beaconhouse.net/prism/
`;

const BASE_SYSTEM = `
NIMBUS RESPONSE ROUTING:
- Use Keywords, Answer Structure, Example Answer, and Key Fact only when the student explicitly wants a written/model/exam/homework answer to rephrase.
- Requests such as "explain this topic", "summarize this", "give me an overview", "teach me about", or ordinary factual questions must use a natural explanation or summary instead.
- Study plans, quizzes, attached-file analysis, Beaconhouse questions, founder/project questions, and general chat must stay natural.
- The structured answer format is a writing scaffold, not Nimbus's default response style.

CORE BEHAVIOUR:
- Answer the current user request first. Use chat history only when it helps resolve references.
- Be accurate, direct, friendly, and age-appropriate for school students.
- General knowledge questions are allowed; do not pretend every question is textbook-only.
- Beaconhouse-specific questions should be factual and should not invent private records, winners, schedules, eligibility rules, or campus-specific facts.

LIGHT EDUCATIONAL FORMAT:
- For educational/schoolwork questions, the final Nimbus reply uses exactly these sections: Keywords, Answer Structure, Key Fact (8 shuffled words).
- Answer Structure contains exactly three short roadmap lines.
- Every Answer Structure line must be 10 words or fewer.
- The roadmap guides creativity only: define/how formed, explain development, then final result/function/importance. Do not place the actual answer inside Answer Structure.
- Include one short Example Answer (starter) after Answer Structure. It gives a useful starting idea but must stay incomplete enough to require the student's own wording. Do not add any additional full explanation after Key Fact.
- Casual and non-educational questions should remain natural.
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
  const raw = Array.isArray(body?.history)
    ? body.history
    : (Array.isArray(body?.messages) ? body.messages : []);

  const duplicateText = textOf(body?.current_user_text || currentUserText);
  const cleaned = [];

  for (const item of raw) {
    const content = normalizeMessageText(item);
    if (!content) continue;
    cleaned.push({ role: normalizeRole(item), text: content });
  }

  while (
    cleaned.length &&
    cleaned.at(-1).role === 'user' &&
    cleaned.at(-1).text === duplicateText
  ) {
    cleaned.pop();
  }

  const merged = [];
  for (const item of cleaned) {
    const last = merged.at(-1);
    if (last && last.role === item.role) last.text += '\n' + item.text;
    else merged.push({ ...item });
  }

  const maxMessages = typeof MAX_HISTORY_MESSAGES === 'number' ? MAX_HISTORY_MESSAGES : 12;
  let chars = typeof MAX_HISTORY_CHARS === 'number' ? MAX_HISTORY_CHARS : 14000;
  const bounded = [];

  for (let i = merged.length - 1; i >= 0 && bounded.length < maxMessages; i -= 1) {
    if (merged[i].text.length > chars) break;
    bounded.unshift(merged[i]);
    chars -= merged[i].text.length;
  }

  while (bounded.length && bounded[0].role === 'model') bounded.shift();

  const contents = bounded.map(item => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));

  const parts = [];
  const attachment = body?.attachment;
  const allowed = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]);

  if (
    attachment?.data &&
    attachment?.mimeType &&
    allowed.has(String(attachment.mimeType).toLowerCase())
  ) {
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.data
      }
    });
  }

  parts.push({ text: currentUserText });
  contents.push({ role: 'user', parts });

  return contents;
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

function normalizeTaskMode(value) {
  const mode = textOf(value).toLowerCase().replace(/-/g,'_');
  return ['explain_topic','study_plan','quiz','study_file'].includes(mode) ? mode : '';
}

function hasWrittenAnswerIntent(text) {
  const s = textOf(text).toLowerCase();

  return /\b(?:write|draft|compose|prepare)\b.{0,28}\b(?:answer|response|paragraph)\b/i.test(s) ||
    /\b(?:help\s+me\s+answer|how\s+(?:should|do)\s+i\s+answer|what\s+should\s+i\s+write|answer\s+this\s+question|give\s+me\s+an\s+answer|model\s+answer|sample\s+answer|exam[-\s]?style\s+answer|homework\s+answer|written\s+answer|short\s+answer|long\s+answer)\b/i.test(s) ||
    /\b(?:for|worth)\s+\d+\s*marks?\b/i.test(s) ||
    /\b\d+\s*mark\s+(?:question|answer)\b/i.test(s);
}

function inferTaskMode(text) {
  const s = textOf(text).toLowerCase();

  if (/\b(?:build|make|create)\b.*\b(?:study|revision)\s+plan\b|\b(?:study|revision)\s+plan\b/i.test(s)) {
    return 'study_plan';
  }

  if (/\b(?:start\s+(?:a\s+)?quiz|quiz\s+me|test\s+me)\b/i.test(s)) {
    return 'quiz';
  }

  if (/\b(?:study|analyse|analyze|summari[sz]e|review)\b.*\b(?:attached|attachment|file|document|pdf)\b/i.test(s)) {
    return 'study_file';
  }

  // Explain/summary requests are learning requests, not written-answer tasks.
  // Explicit answer-writing intent always wins instead.
  if (!hasWrittenAnswerIntent(s) && (
      /\b(?:summari[sz]e|summary|overview|explain\s+(?:this|the|a|an)?\s*topic|explain\s+.+|teach\s+me\s+about|give\s+me\s+(?:a\s+)?summary)\b/i.test(s)
    )) {
    return 'explain_topic';
  }

  return '';
}

function taskModeInstruction(mode, text) {
  const request = textOf(text);

  if (mode === 'explain_topic') {
    return '[EXPLAIN TOPIC MODE]\nGive a clear, concise student-friendly explanation or summary. Use normal headings or short paragraphs only when useful. Do NOT use Keywords, Answer Structure, Example Answer, or Key Fact. Focus on understanding the topic, not on drafting an exam answer for the student.\nUser request: ' + request;
  }

  if (mode === 'study_plan') {
    return '[STUDY PLAN MODE]\nDo not use Keywords, Answer Structure, Example Answer, or Key Fact. If important details are missing, ask concise questions about subjects/topics, exam date, available study time, weak areas, and priorities. Once enough details are known, build a practical schedule with sessions, breaks, revision, practice, and checkpoints.\nUser request: ' + request;
  }

  if (mode === 'quiz') {
    return '[QUIZ MODE]\nDo not use Keywords, Answer Structure, Example Answer, or Key Fact. If topic or difficulty is missing, ask for it first. Then ask exactly one quiz question at a time and wait for the student answer before continuing. Give brief feedback after each answer without revealing future answers.\nUser request: ' + request;
  }

  if (mode === 'study_file') {
    return '[STUDY FILE MODE]\nUse the attached file as the primary source. Do not use Keywords, Answer Structure, Example Answer, or Key Fact. Summarize important ideas, identify key terms, explain what the student should revise, and highlight likely exam-focus areas. Do not invent content not supported by the attachment.\nUser request: ' + request;
  }

  return request;
}

function classifyQuestion(text, taskMode = '') {
  const s = textOf(text).toLowerCase();
  const mode = normalizeTaskMode(taskMode) || inferTaskMode(s);

  if (!s) return 'empty';
  if (mode) return 'task';

  if (/^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|bye|good morning|good afternoon|good evening|good night)[!.?,\s]*$/i.test(s)) {
    return 'casual';
  }

  if (/\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\bilap\b|\blap\b|\bboss\b|\bbooklist\b|\bcampus\b|\badmissions?\b|\bcompetition\b/i.test(s)) {
    return 'beaconhouse';
  }

  // The special learning format is ONLY for written-answer intent.
  // A normal "explain", "summarize", "what is", or "teach me" request
  // should be answered naturally instead.
  if (hasWrittenAnswerIntent(s)) {
    return 'educational';
  }

  return 'general';
}

/* NIMBUS_V9_EDUCATIONAL_FORMATTER */
function nimbusFormatWords(answer, question) {
  const stop = new Set('the a an and or of to in on for with is are was were be been being this that these those how what why does do did it its their our your from by as at into about than then can could should would may might will shall explain explanation main very more less also keyword keywords answer structure key fact facts section sections'.split(/\s+/));
  const source = (String(question||'')+' '+String(answer||'')).replace(/https?:\/\/\S+/g,' ');
  const candidates = source.match(/[A-Za-z][A-Za-z-]*/g) || [];
  const words = [];

  for (const raw of candidates) {
    const word = raw.toLowerCase().replace(/^-+|-+$/g,'');
    if (word.length < 3 || stop.has(word) || words.includes(word)) continue;
    words.push(word);
    if (words.length >= 12) break;
  }

  const fallback = ['structure','function','process','system','change','movement','result','importance','concept','stage','purpose','sequence'];
  for (const word of fallback) {
    if (words.length >= 12) break;
    if (!words.includes(word)) words.push(word);
  }
  return words;
}

function nimbusTopicFromQuestion(question) {
  const cleaned = removeVisualCommand(question || '')
    .replace(/[?!.:,;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ignore = new Set(
    'explain describe define discuss tell show give write make what whats what\'s is are was were how does do did why who when where compare difference between the a an of to in on for with and or please about work works working formed form formation happens happened happen process stages steps'.split(/\s+/)
  );

  const words = (cleaned.match(/[A-Za-z][A-Za-z-]*/g) || [])
    .filter(word => !ignore.has(word.toLowerCase()))
    .slice(0, 3);

  return words.join(' ') || 'the topic';
}

function nimbusLimitRoadmap(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 10) return words.join(' ');
  return words.slice(0, 10).join(' ').replace(/[,:;]+$/,'') + '.';
}

function nimbusBuildRoadmap(question, words) {
  const q = removeVisualCommand(question || '').toLowerCase();
  const topic = nimbusTopicFromQuestion(question);
  const topicWords = new Set(topic.toLowerCase().split(/\s+/));
  const useful = (Array.isArray(words) ? words : [])
    .filter(word => !topicWords.has(String(word).toLowerCase()))
    .slice(0, 6);

  const a = useful[0] || 'main features';
  const b = useful[1] || 'important stages';
  const c = useful[2] || 'key changes';
  const d = useful[3] || 'final result';

  let lines;

  if (/\b(compare|difference|different|similar|similarities|versus|vs)\b/.test(q)) {
    lines = [
      'Define ' + topic + ' and identify both compared ideas.',
      'Compare their main features, processes, similarities, and differences.',
      'Conclude with the most important comparison and significance.'
    ];
  } else if (/\b(why|cause|causes|reason|reasons)\b/.test(q)) {
    lines = [
      'Define ' + topic + ' and identify the main cause.',
      'Explain how the causes lead to each major effect.',
      'Conclude with the final effect and overall importance.'
    ];
  } else if (/\b(function|purpose|role|importance|important)\b/.test(q)) {
    lines = [
      'Define ' + topic + ' and identify its main function.',
      'Explain how its parts or stages perform that function.',
      'Conclude with why that function is important.'
    ];
  } else if (/\b(how|formed|formation|develop|developed|process|stages|steps|work|works)\b/.test(q)) {
    lines = [
      'Define ' + topic + ' and identify its starting point.',
      'Explain each stage and how the process develops further.',
      'Conclude with the final result and its importance.'
    ];
  } else if (/\b(what is|what are|define|meaning)\b/.test(q)) {
    lines = [
      'Define ' + topic + ' clearly in simple terms.',
      'Explain ' + a + ', ' + b + ', and ' + c + '.',
      'Conclude with ' + d + ' and overall importance.'
    ];
  } else {
    lines = [
      'Define ' + topic + ' and state its main idea.',
      'Explain how ' + a + ', ' + b + ', and ' + c + ' connect.',
      'Conclude with ' + d + ' and the topic\'s importance.'
    ];
  }

  return lines.map(nimbusLimitRoadmap);
}

function nimbusBuildExampleAnswer(answer, question, words) {
  const raw = cleanText(answer || '').replace(/\s+/g, ' ').trim();
  const topic = nimbusTopicFromQuestion(question || '');
  const topicParts = topic.toLowerCase().split(/\s+/);
  const useful = (Array.isArray(words) ? words : [])
    .filter(Boolean)
    .filter(word => !topicParts.includes(String(word).toLowerCase()))
    .slice(0, 3);

  const sentences = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  let starter = sentences[0] || (topic + ' is an important idea to explain clearly.');
  let starterWords = starter.split(/\s+/).filter(Boolean);

  if (starterWords.length > 24) {
    starter = starterWords.slice(0, 24).join(' ').replace(/[,:;]+$/,'') + '...';
  }

  const continueWith = useful.length ? useful.join(', ') : 'its main process and importance';
  let example = starter + ' Continue by explaining ' + continueWith + ' in your own words.';
  const wordsOut = example.split(/\s+/).filter(Boolean);

  if (wordsOut.length > 42) {
    example = wordsOut.slice(0, 42).join(' ').replace(/[,:;]+$/,'') + '...';
  }

  return example;
}

function formatEducationalAnswer(answer, question) {
  const raw = cleanText(answer || '');
  const q = removeVisualCommand(question || '');
  const words = nimbusFormatWords(raw, q);
  const keywords = words.slice(0, 6);
  const roadmap = nimbusBuildRoadmap(q, words);
  const exampleAnswer = nimbusBuildExampleAnswer(raw, q, words);

  const keyWords = words.slice(0, 8);
  const shift = keyWords.length
    ? Array.from(q).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % keyWords.length
    : 0;
  const shuffled = keyWords.slice(shift).concat(keyWords.slice(0, shift));

  return [
    'Keywords: ' + keywords.join(', '),
    '',
    'Answer Structure:',
    '1. ' + roadmap[0].replace(/^\d+\.\s*/, ''),
    '2. ' + roadmap[1].replace(/^\d+\.\s*/, ''),
    '3. ' + roadmap[2].replace(/^\d+\.\s*/, ''),
    '',
    'Example Answer (starter): ' + exampleAnswer,
    '',
    'Key Fact (8 shuffled words): ' + shuffled.slice(0, 8).join(' ')
  ].join('\n').trim();
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
  const original = textOf(text);
  const s = original.toLowerCase();

  if (/\b(who\s+(?:made|built|created|founded)|founder|co-?founder|creator)\b.*\bnimbus\b|\bnimbus\b.*\b(founder|co-?founder|creator)\b/i.test(original)) {
    return 'Nimbus is an educational-focused AI project built manually by Abdul Haadi Hassan, its founder. The project is designed around student learning: concise educational guidance, question-focused answer structures, saved conversations, Beaconhouse-aware information, and optional on-demand FLUX visuals. Nimbus is independently built and should not be described as officially owned or endorsed by Beaconhouse unless an official source says so.';
  }
  if (/\bbeams\b|beaconhouse enterprise application management system/i.test(original)) {
    return 'BEAMS is the Beaconhouse Enterprise Application Management System. It serves as Beaconhouse\'s internal comprehensive Enterprise Resource Planning (ERP) and digital ecosystem used across staff, employees, and students. Users access connected internal services through their BEAMS ID. Beaconhouse also links BEAMS credentials with services such as PRISM for professional development. Official BEAMS portal: https://beams.beaconhouse.net/home/. PRISM: https://beams.beaconhouse.net/prism/.';
  }



  if (/\bbisc\b|beaconhouse international student convention/i.test(original)) {
    return 'BISC stands for Beaconhouse International Student Convention. It is an international Beaconhouse student platform that brings learners together to connect, collaborate, compete, and showcase their talents. BISC includes activities across areas such as sports, creativity, knowledge, innovation, debate, gaming, culture, and other student challenges. Its wider purpose includes cross-cultural friendship, healthy competition, teamwork, student agency, global awareness, and collaboration. Official BISC information: https://bisc.beaconhouse.net/ and https://bisc.beaconhouse.net/about-bisc/.';
  }

  if (/\bilap\b|international learner agency paradigm/i.test(original)) {
    return 'ILAP stands for International Learner Agency Paradigm Conference. It is the international development of Beaconhouse learner-agency conferences and brings students and teachers together around meaningful action, real learning, learner agency, and teacher agency. Recent ILAP guidance also connects projects with AI in education, Beaconhouse strategic intents, and relevant UN Sustainable Development Goals. Official ILAP/LAP guidance: https://lap.beaconhouse.net/guidelines-ilap-2027/.';
  }

  if (/\blap\b|learner agency paradigm/i.test(original)) {
    return 'LAP stands for Learner Agency Paradigm. At Beaconhouse, its vision is to move learners from passive receivers toward active contributors by strengthening student voice, initiative, ownership, empathy, social responsibility, personal growth, equity, tolerance, and purposeful action. LAP conferences showcase learner agency in practice, with students taking meaningful responsibility for ideas, projects, and learning. Official LAP information: https://lap.beaconhouse.net/ and https://lap.beaconhouse.net/about-us/.';
  }

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
    const taskMode = normalizeTaskMode(body?.task_mode) || inferTaskMode(userText);
    const questionType = classifyQuestion(userText, taskMode);
    const modelUserText = taskMode ? taskModeInstruction(taskMode, userText) : userText;
    body.current_user_text = userText;
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
        currentUserText: modelUserText,
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
            currentUserText: modelUserText,
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
            currentUserText: modelUserText,
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

    let answer = extractText(data);
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

    if (questionType === 'educational') answer = formatEducationalAnswer(answer, userText);

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
