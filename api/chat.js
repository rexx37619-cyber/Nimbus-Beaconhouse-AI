import { reserveRpd, allowedOrigin } from '../lib/nimbus-public-guard.js';
import { guidedEducation } from '../lib/nimbus-guided.js';
import { generateDynamicGuide, numericMathRequest } from '../lib/nimbus-dynamic-guide.js';
import { safetyReview, safeGeneratedText, GEMINI_STUDENT_SAFETY } from '../lib/nimbus-safety.js';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Nimbus 4.5 ROR: pin supported Gemini endpoints. Old 2.5-Lite returns MODEL_NOT_FOUND for new accounts.
const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const THIRD_MODEL = '';
const DAILY_LIMIT = 50; // best-effort server instance cap; NOT a durable global quota
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

const BASE_SYSTEM = `KEY FACT SOURCE RULE:
- For written-answer scaffold requests, internally provide at least two concise factual sentences.
- The first may support the Example Answer starter; another must contain a different useful fact for Key Fact.
- Do not repeat the same fact twice.

NIMBUS RESPONSE ROUTING:
- Use Keywords, Answer Structure, Example Answer, and Key Fact for academic school-answer questions even without a special button, as well as explicitly requested writing help.
- Brief school-style prompts such as "Explain respiration", "What is diffusion?", or "Who were the Mughals?" use the writing scaffold. Explicit summaries, detailed lessons, coding requests, and casual questions stay natural.
- Study plans, quizzes, attached-file analysis, Beaconhouse questions, founder/project questions, and general chat must stay natural.
- The structured format is a schoolwork scaffold, not the default for general conversation, research, study plans, quizzes, or file analysis.

CORE BEHAVIOUR:
- Answer the current user request first. Use chat history only when it helps resolve references.
- Be accurate, direct, friendly, and age-appropriate for school students.
- General knowledge questions are allowed; do not pretend every question is textbook-only.
- Beaconhouse-specific questions should be factual and should not invent private records, winners, schedules, eligibility rules, or campus-specific facts.

LIGHT EDUCATIONAL FORMAT:
- For written-answer requests, Nimbus uses Keywords, a question-specific Answer Structure or short Hint, a brief Example Answer starter, and one normal Key Fact of no more than 14 words. The Key Fact must be factual and must never be shuffled.
- Answer Structure MUST be one complete roadmap sentence of at most 10 words, containing only writing steps, never facts or an explanation. Short questions get a relevant Hint instead.
- Include one very short Example Answer starter fragment (about 10 words), followed by "... Rephrase this answer on your own." It must not be a complete copy-paste answer.
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

function nimbusBuildWrittenSourcePrompt(question) {
  const q = nimbusCleanWrittenQuestion(question);

  if (nimbusIsCreativeWritingPrompt(q)) {
    return [
      '[NIMBUS ENGLISH WRITING SCAFFOLD]',
      'Student writing task: ' + q,
      'Return exactly these six labelled lines and nothing else:',
      'NIMBUS_ANSWER_SOURCE: Give 2 concise possible ideas for setting, character, or purpose, not a finished composition.',
      'NIMBUS_KEYWORDS_SOURCE: Give 4-6 vivid, relevant writing concepts or thematic keywords.',
      'NIMBUS_STRUCTURE_SOURCE: Give one complete question-specific sentence organizing the beginning, development, and ending, without writing the whole story or essay.',
      'NIMBUS_STARTER_SOURCE: Give a vivid, original opening fragment of 8-14 words, not copied from the prompt; stop before telling the whole story.',
      'NIMBUS_HINT_SOURCE: Give one relevant creative clue of at most 14 words.',
      'NIMBUS_KEY_FACT_SOURCE: Give one practical writing-craft tip of at most 14 words, different from the starter.',
      'Keep this a creative writing scaffold. Do not deliver a complete essay, letter, narrative, or paragraph.'
    ].join('\n');
  }

  return [
    '[NIMBUS WRITING SOURCE]',
    'Student question: ' + q,
    '',
    'Return exactly these six lines and nothing else:',
    'NIMBUS_ANSWER_SOURCE: Give 2-3 concise, accurate factual sentences that answer the question.',
    'NIMBUS_KEYWORDS_SOURCE: Give 4-6 subject-specific academic keywords or short phrases relevant to the answer. Do not include command words such as who, what, define, explain, write, question, answer, or duplicate terms.',
    'NIMBUS_STRUCTURE_SOURCE: Give one question-specific roadmap of 10 words maximum: only steps for composing the answer, never explanatory facts, and no lists.',
    'NIMBUS_STARTER_SOURCE: Give one natural opening sentence fragment of 8-14 words that directly begins a correct answer. It must contain real subject content, must not copy the wording of the question, must not use generic phrases such as "can be described as", and must stay incomplete enough that the student must continue it.',
    'NIMBUS_HINT_SOURCE: Give one question-specific clue of at most 14 words. Do not reveal the exact answer.',
    'NIMBUS_KEY_FACT_SOURCE: Give exactly one accurate, relevant, distinct supporting FACT (14 words maximum). No explanation, instructions, or repetition of the starter.',
    '',
    'The starter must sound like the beginning of a real student answer, not a rewritten question.',
    'For multi-part questions, begin with the first required idea and leave the rest for the student.',
    'Do not end the starter with a complete conclusion.'
  ].join('\n');
}

/* NIMBUS_V28_AUTO_SCHOOL_QUESTION_SENSOR */
function nimbusIsCreativeWritingPrompt(text) {
  const s = textOf(text).toLowerCase();
  return /\b(?:write|compose|draft|create|plan|outline|help\s+me\s+(?:write|with))\b.{0,90}\b(?:narrative|short\s+story|story|essay|report(?:\s+writing)?|descriptive\s+(?:writing|paragraph)|creative\s+writing|formal\s+letter|informal\s+letter|letter\s+to|speech|newspaper\s+article|article|report\s+writing|diary\s+entry)\b/i.test(s) ||
    /\b(?:narrative|story|essay|descriptive|persuasive|argumentative)\s+writing\b/i.test(s);
}

function nimbusShouldScaffoldAcademic(text) {
  const s = nimbusCleanWrittenQuestion(removeVisualCommand(text)).toLowerCase().trim();
  if (!s) return false;
  if (hasWrittenAnswerIntent(s) || nimbusIsCreativeWritingPrompt(s)) return true;

  // Explicit summaries, detailed lessons, coding tasks and everyday chat remain natural.
  if (/^(?:hi|hello|hey|yo|thanks|thank\s+you|good\s+(?:morning|evening)|how\s+are\s+you)\b/i.test(s)) return false;
  if (/\b(?:nimbus|beaconhouse|bisc|beams|ilap|\blap\b|nimtron|codus)\b/i.test(s)) return false;
  if (/\b(?:javascript|typescript|python|node\.?js|react|html|css|c\+\+|c#|java|golang|rust|api\s+(?:endpoint|key)|github|git\b|programming|coding|write\s+code|debug|script|software|roblox\s+studio|unity\s+engine|unreal\s+engine|luau)\b/i.test(s)) return false;
  if (/\b(?:summari[sz]e|summary|overview|give\s+me\s+a\s+full\s+explanation|teach\s+me\s+about|walk\s+me\s+through|in\s+(?:full\s+)?detail|detailed\s+explanation|explain\s+in\s+depth|explain\s+thoroughly)\b/i.test(s)) return false;
  if (/\b(?:study|revision)\s+plan\b|\b(?:start\s+a\s+quiz|quiz\s+me|test\s+me)\b|\b(?:attached\s+file|uploaded\s+file|attached\s+document)\b/i.test(s)) return false;

  const academicTopic = /\b(?:respiration|breathing|lungs?|alveoli|diffusion|osmosis|photosynthesis|water\s+cycle|food\s+(?:webs?|chains?)|periodic\s+table|stomata|vertebrates?|invertebrates?|cells?|blood|heart|circulatory|digestive|nervous|excretory|muscles?|joints?|nutrition|ecosystems?|pollution|electricity|circuits?|forces?|friction|gravity|energy|atoms?|molecules?|acids?|bases?|chemical|evaporation|condensation|erosion|climate|landforms?|rivers?|volcanoes?|earthquakes?|geography|weathering|population|latitude|longitude|mughals?|abbasids?|umayyads?|history|historical|medieval|renaissance|revolution|empires?|civilizations?|colonialism|democracy|monarchy|wars?|treaty|independence|metaphors?|similes?|poetry|poems?|alliteration|personification|imagery|literature|novels?|english\s+grammar|tenses?|nouns?|verbs?|adjectives?|fractions?|percentages?|algebra|geometry|equations?|angles?|triangles?|ratios?|probability|statistics|mathematics|maths?)\b/i;
  const schoolCue = /\b(?:school|homework|assignment|worksheet|exam|marks?|class\s*\d+|grade\s*\d+|textbook|science|biology|chemistry|physics|geography|history|english|literature|maths?|mathematics)\b/i;
  const academicQuestion = /^(?:(?:please|can\s+you|could\s+you|kindly)\s+)?(?:explain|what\s+(?:is|are|was|were|does|do)|who\s+(?:was|were|is|are)|why\s+(?:is|are|does|do|did|was|were)|how\s+(?:does|do|did|is|are|was|were)|define|describe|compare|differentiate|discuss|outline|identify|name|list|state|give\s+(?:two|three|four|five)\s+(?:examples?|reasons?|causes?|features?))\b/i;
  if (academicQuestion.test(s) && (academicTopic.test(s) || schoolCue.test(s))) return true;
  if (/^(?:define|differentiate|compare|describe)\s+(?:the\s+)?[\w\s,'-]{3,140}[?.!]*$/i.test(s) && (academicTopic.test(s) || schoolCue.test(s))) return true;
  return false;
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

  // Only explicitly requested summaries or full lessons use natural explain mode.
  // Brief school prompts like "Explain respiration" use the academic scaffold.
  if (/\b(?:summari[sz]e|summary|overview|teach\s+me\s+about|walk\s+me\s+through|in\s+(?:full\s+)?detail|explain\s+in\s+depth|explain\s+thoroughly)\b/i.test(s)) {
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

  // Recognize academic exam-style questions even without the writing button.
  if (hasWrittenAnswerIntent(s) || nimbusShouldScaffoldAcademic(s)) {
    return 'educational';
  }

  return 'general';
}

/* NIMBUS_V9_EDUCATIONAL_FORMATTER */
function nimbusCleanWrittenQuestion(question) {
  return removeVisualCommand(question || '')
    .replace(/^help\s+me\s+write\s+this\s+answer\s*:\s*/i, '')
    .replace(/^help\s+me\s+write\s+(?:an\s+)?answer\s+to\s+this\s+question\s*:\s*/i, '')
    .replace(/^help\s+me\s+write\s+this\s+question\s*:\s*/i, '')
    .replace(/^help\s+me\s+answer\s+this\s+question\s*:\s*/i, '')
    .replace(/^answer\s+this\s+question\s*:\s*/i, '')
    .replace(/^write\s+(?:an\s+)?answer\s+(?:to|for)\s+(?:this\s+)?question\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nimbusExtractScaffoldSource(answer, label) {
  const raw = cleanText(answer || '');
  const safeLabel = String(label || '').replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  const rx = new RegExp('(?:^|\\n)\\s*' + safeLabel + '\\s*:\\s*([^\\n]+)', 'i');
  const match = raw.match(rx);
  return match && match[1] ? cleanText(match[1]).replace(/\s+/g,' ').trim() : '';
}

function nimbusCleanAnswerContent(answer) {
  let raw = cleanText(answer || '').trim();
  if (!raw) return '';

  const answerSource = nimbusExtractScaffoldSource(raw, 'NIMBUS_ANSWER_SOURCE');
  if (answerSource) return answerSource;

  const example = raw.match(
    /(?:^|\n)\s*Example Answer(?:\s*\(starter\))?\s*:\s*([\s\S]*?)(?=\n\s*(?:Key Fact|Keywords|Answer Structure|Hint|NIMBUS_[A-Z_]+)\s*:|$)/i
  );

  if (example && example[1]) {
    return cleanText(example[1]).replace(/\s+/g,' ').trim();
  }

  raw = raw
    .replace(/^\s*NIMBUS_(?:ANSWER|KEYWORDS|STRUCTURE|STARTER|HINT|KEY_FACT)_SOURCE\s*:[^\n]*\n?/gim,' ')
    .replace(/^\s*Keywords\s*:[^\n]*\n?/gim,' ')
    .replace(/^\s*Key Fact(?:\s*\(8\s*shuffled\s*words\))?\s*:[^\n]*\n?/gim,' ')
    .replace(/^\s*Hint\s*:[^\n]*\n?/gim,' ')
    .replace(/^\s*Answer Structure\s*:\s*[\s\S]*?(?=^\s*(?:Example Answer|Key Fact|Keywords|Hint|NIMBUS_[A-Z_]+)\s*:|$)/gim,' ')
    .replace(/^\s*Example Answer(?:\s*\(starter\))?\s*:\s*/gim,' ')
    .replace(/\s+/g,' ')
    .trim();

  return raw;
}

function nimbusFormatWords(answer, question) {
  const stop = new Set(
    'the a an and or of to in on for with is are was were be been being this that these those how what why does do did it its their our your from by as at into about than then can could should would may might will shall explain explanation main very more less also keyword keywords answer structure key fact facts section sections help write writing question questions answer answers name list state give identify mention tell one two three four five six seven eight nine ten thing things rephrase own words'.split(/\s+/)
  );

  const q = nimbusCleanWrittenQuestion(question);
  const cleanAnswer = nimbusCleanAnswerContent(answer);
  const source = (q + ' ' + cleanAnswer).replace(/https?:\/\/\S+/g,' ');
  const candidates = source.match(/[A-Za-z][A-Za-z-]*/g) || [];
  const words = [];

  for (const raw of candidates) {
    const word = raw.toLowerCase().replace(/^-+|-+$/g,'');
    if (word.length < 3 || stop.has(word) || words.includes(word)) continue;
    words.push(word);
    if (words.length >= 12) break;
  }

  const fallback = ['concept','process','function','example','result','importance','system','change','stage','purpose','effect','relationship'];
  for (const word of fallback) {
    if (words.length >= 12) break;
    if (!words.includes(word)) words.push(word);
  }

  return words;
}

function nimbusTopicFromQuestion(question) {
  const cleaned = nimbusCleanWrittenQuestion(question)
    .replace(/[?!.:,;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const ignore = new Set(
    'explain describe define discuss tell show give write make name list state identify mention what whats what\'s is are was were how does do did why who when where compare difference between the a an of to in on for with and or please about work works working formed form formation happens happened happen process stages steps help answer question one two three four five six seven eight nine ten'.split(/\s+/)
  );

  const words = (cleaned.match(/[A-Za-z][A-Za-z-]*/g) || [])
    .filter(word => !ignore.has(word.toLowerCase()))
    .slice(0, 4);

  return words.join(' ') || 'the topic';
}

function nimbusLimitRoadmap(line) {
  const words = String(line || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 10) return words.join(' ');
  return words.slice(0, 10).join(' ').replace(/[,:;]+$/,'') + '.';
}

function nimbusBuildKeywords(answer, question) {
  const banned = new Set('who what why how when where which define explain describe discuss write writing question answer help please tell give name list state identify mention this that these those one two three four five'.split(/\s+/));
  const sourced = nimbusExtractScaffoldSource(answer, 'NIMBUS_KEYWORDS_SOURCE');
  const result = [];

  for (let item of sourced.split(/[,;|]/).map(x => x.trim()).filter(Boolean)) {
    item = item.replace(/^\d+[\).\s-]*/,'').replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim();
    const lower = item.toLowerCase();
    const itemWords = lower.match(/[a-z][a-z-]*/g) || [];
    if (!itemWords.length || itemWords.every(w => banned.has(w)) || banned.has(lower)) continue;
    if (result.some(x => x.toLowerCase() === lower)) continue;
    result.push(item);
    if (result.length >= 6) break;
  }

  if (result.length >= 4) return result;

  return nimbusFormatWords(nimbusCleanAnswerContent(answer), nimbusCleanWrittenQuestion(question))
    .filter(word => !banned.has(String(word).toLowerCase()))
    .filter((word,index,arr) => arr.findIndex(x => String(x).toLowerCase() === String(word).toLowerCase()) === index)
    .slice(0,6);
}

function nimbusBuildAnswerStructure(answer, question) {
  // A writing roadmap, not a miniature explanation. Deliberately do not copy
  // Gemini's structure source: it can contain subject facts and full answers.
  const q = nimbusCleanWrittenQuestion(question).toLowerCase();
  const topicWords = nimbusTopicFromQuestion(question).split(/\s+/).filter(Boolean).slice(0, 3);
  const topic = topicWords.join(' ') || 'the topic';
  let guide;

  if (/\bcrusades?\b/.test(q) && /\b(?:church|catholic|sacrament)\b/.test(q)) {
    guide = 'Introduce the Crusades, discuss Church influence, then conclude.';
  } else if (/\b(?:narrative|short story|story)\b/.test(q)) {
    guide = 'Establish setting, develop conflict, then conclude with resolution.';
  } else if (/\b(?:report|newspaper article)\b/.test(q)) {
    guide = 'Introduce the subject, organize findings, then provide a conclusion.';
  } else if (/\b(?:compare|contrast|differences?|similarities?|versus|vs\.?|differentiate)\b/.test(q)) {
    guide = 'Introduce both subjects, compare features, then summarize key differences.';
  } else if (/\b(?:causes?\s+and\s+effects?|effects?\s+and\s+causes?)\b/.test(q)) {
    guide = 'Introduce the issue, outline causes, then discuss effects.';
  } else if (/\b(?:why|causes?|reasons?)\b/.test(q)) {
    guide = 'Introduce the topic, explain causes, then assess significance.';
  } else if (/\b(?:who\s+(?:were|was|are|is)|history|historical|mughals?|abbasids?|umayyads?|dynasty|empire)\b/.test(q)) {
    guide = 'Introduce ' + topic + ', outline achievements, then discuss influence.';
  } else if (/\b(?:how|formed|formation|process|stages?|steps?|cycle|works?)\b/.test(q)) {
    guide = 'Define ' + topic + ', outline stages, then state outcomes.';
  } else if (/\b(?:functions?|importance|purpose|role)\b/.test(q)) {
    guide = 'Define ' + topic + ', outline functions, then explain importance.';
  } else if (/\b(?:what\s+(?:is|are|was|were)|define|meaning)\b/.test(q)) {
    guide = 'Define ' + topic + ', mention features, then state significance.';
  } else {
    guide = 'Introduce ' + topic + ', outline key ideas, then conclude.';
  }

  // Hard bound: exactly one complete roadmap sentence, at most ten words.
  const words = guide.trim().split(/\s+/).filter(Boolean);
  return (words.length <= 10 ? guide : words.slice(0, 10).join(' ').replace(/[,:;\s-]+$/, '') + '.')
    .replace(/\.{2,}$/, '.');
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

function nimbusIsShortAnswerQuestion(question) {
  const q = nimbusCleanWrittenQuestion(question).toLowerCase();
  const count = (q.match(/[A-Za-z0-9-]+/g) || []).length;

  if (/^(?:name|list|state|identify|mention|give)\b/i.test(q) && count <= 18) return true;
  if (/^(?:what\s+does|what\s+is|what\s+are|define|which)\b/i.test(q) && count <= 14) return true;
  if (/\b(?:one|two|three|four|five|\d+)\s+(?:examples?|things?|types?|reasons?|causes?|effects?|functions?|features?|toxins?|items?)\b/i.test(q) && count <= 18) return true;

  return false;
}

function nimbusBuildShortHint(answer, question) {
  const q = nimbusCleanWrittenQuestion(question);
  const lower = q.toLowerCase();

  let sourced = nimbusExtractScaffoldSource(answer, 'NIMBUS_HINT_SOURCE')
    .replace(/\.\.\..*$/,'')
    .replace(/\s+/g,' ')
    .trim();

  if (sourced && !/\b(?:the answer is|answer:|rephrase|own words)\b/i.test(sourced)) {
    let words = sourced.split(/\s+/).filter(Boolean);
    if (words.length > 14) words = words.slice(0,14);
    sourced = words.join(' ').replace(/[,:;\-]+$/,'').trim();
    if (!/[.!?]$/.test(sourced)) sourced += '.';
    return sourced;
  }

  const topic = nimbusTopicFromQuestion(q);

  if (/\bstrongest\b.*\bmuscle\b|\bmuscle\b.*\bstrongest\b/i.test(lower)) {
    return 'Think about the jaw muscle used when biting with great force.';
  }

  if (/\btoxin|pollut|ecosystem|bioaccumul/i.test(lower)) {
    return 'Think about persistent pollutants that can build up inside living organisms.';
  }

  if (/\b(history|empire|war|revolution|medieval|civilization)\b/i.test(lower)) {
    return 'Focus on the key person, event, cause, or consequence asked about.';
  }

  if (/\b(geography|river|climate|weather|erosion|population|map)\b/i.test(lower)) {
    return 'Focus on the location, process, or physical factor named in the question.';
  }

  if (/\b(math|maths|equation|algebra|geometry|ratio|percentage|fraction)\b/i.test(lower)) {
    return 'Identify the known values and the relationship or formula connecting them.';
  }

  if (/^(?:name|list|state|identify|mention|give)\b/i.test(lower)) {
    return 'Recall the exact number of distinct examples requested for ' + topic + '.';
  }

  if (/^what\s+does\b|\bmean\b/i.test(lower)) {
    return 'Focus on the simplest meaning of ' + topic + ' and its defining idea.';
  }

  if (/^what\s+(?:is|are)\b|^define\b/i.test(lower)) {
    return 'Think of a short definition of ' + topic + ' and one defining feature.';
  }

  return 'Focus on the clue words in the question and the key idea of ' + topic + '.';
}

function nimbusBuildExampleAnswer(answer, question, words) {
  const q = nimbusCleanWrittenQuestion(question);
  const raw = nimbusCleanAnswerContent(answer);

  let starter = nimbusExtractScaffoldSource(answer, 'NIMBUS_STARTER_SOURCE')
    .replace(/^(?:Example Answer|Starter)\s*:\s*/i,'')
    .replace(/\.\.\..*$/,'')
    .replace(/\s+/g,' ')
    .trim();

  const badGeneric =
    /\b(?:can be described as|can be defined as|is an important idea|the answer is|this question|rephrase|own words)\b/i;

  // Reject a starter that is basically just the question repeated.
  const qWords = new Set(
    q.toLowerCase()
      .replace(/[^a-z0-9\s-]/g,' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  );

  function overlapRatio(text){
    const parts = String(text||'')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g,' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    if(!parts.length) return 1;
    const overlap=parts.filter(word=>qWords.has(word)).length;
    return overlap/parts.length;
  }

  if (!starter || badGeneric.test(starter) || overlapRatio(starter) > 0.72) {
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);

    starter = sentences.find(sentence =>
      sentence &&
      !badGeneric.test(sentence) &&
      overlapRatio(sentence) <= 0.72
    ) || sentences[0] || '';
  }

  starter = String(starter||'')
    .replace(/^(?:Keywords|Answer Structure|Example Answer|Key Fact|Hint)\s*:\s*/i,'')
    .replace(/[.!?]+$/,'')
    .replace(/\s+/g,' ')
    .trim();

  let starterWords=starter.split(/\s+/).filter(Boolean);
  if(starterWords.length>14) starterWords=starterWords.slice(0,14);

  starter=starterWords.join(' ').replace(/[,:;\-]+$/,'').trim();

  if(!starter){
    const topic=nimbusTopicFromQuestion(q);
    starter=topic + ' begins with';
  }

  return starter + '... Rephrase this answer on your own.';
}

function nimbusBuildKeyFact(answer, question) {
  const raw = nimbusCleanAnswerContent(answer);
  const starter = nimbusBuildExampleAnswer(answer, question, []).split('...')[0].trim();
  const source = nimbusExtractScaffoldSource(answer, 'NIMBUS_KEY_FACT_SOURCE');

  const significantWords = text => new Set(
    String(text || '').toLowerCase().match(/[a-z]{4,}/g) || []
  );
  const starterWords = significantWords(starter);
  const badMeta = /\b(?:rephrase|your own words|starter|answer structure|keywords|hint:|key fact source|check your notes)\b/i;
  const instructionStart = /^(?:explain|describe|discuss|define|introduce|remember|think|focus|state|use|write|note|rephrase|compare)\b/i;

  function oneFact(candidate) {
    let fact = String(candidate || '')
      .replace(/^(?:NIMBUS_KEY_FACT_SOURCE|Key Fact)\s*:\s*/i, '')
      .replace(/\s*\.\.\.[\s\S]*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Keep one factual sentence, not a paragraph or joined list of facts.
    const first = fact.match(/^.*?[.!?](?=\s|$)/);
    if (first) fact = first[0].trim();
    fact = fact.replace(/[.!?]+$/, '').trim();
    if (!fact || badMeta.test(fact) || instructionStart.test(fact)) return '';

    const fullWords = significantWords(fact);
    if (fullWords.size < 3) return '';
    const common = [...fullWords].filter(word => starterWords.has(word)).length;
    if (starterWords.size >= 4 && common / Math.max(1, fullWords.size) >= 0.8) return '';

    // Preserve a useful, complete leading clause when the model exceeds the cap.
    const clauses = [fact, ...fact.split(/\s*(?:;|—|–)\s*/).filter(Boolean)];
    let compact = clauses.find(part => part.split(/\s+/).length >= 4 && part.split(/\s+/).length <= 14) || fact;
    let tokens = compact.split(/\s+/).filter(Boolean);
    if (tokens.length > 14) tokens = tokens.slice(0, 14);
    while (tokens.length > 4 && /^(?:and|or|but|in|on|at|of|for|to|with|from|by|the|a|an|which|that|because|during)$/i.test(tokens.at(-1))) tokens.pop();
    compact = tokens.join(' ').replace(/[,:;\s-]+$/, '').trim();
    if (compact.split(/\s+/).length < 4) return '';
    return compact + '.';
  }

  const sentences = raw.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  // Prefer the distinct fact explicitly requested from Gemini; else use a
  // separate supporting sentence from the model's factual answer source.
  const candidates = [source, ...sentences.slice(1), ...sentences.slice(0, 1)];
  for (const candidate of candidates) {
    const fact = oneFact(candidate);
    if (fact) return fact;
  }
  // No fact can safely be inferred from a response lacking factual evidence.
  return 'A reliable supporting fact was not available in this response.';
}

function formatEducationalAnswer(answer, question) {
  const q = nimbusCleanWrittenQuestion(question);
  const raw = nimbusCleanAnswerContent(answer);
  const words = nimbusFormatWords(raw, q);
  const keywords = nimbusBuildKeywords(answer, q);
  const exampleAnswer = nimbusBuildExampleAnswer(answer, q, words);
  const keyFact = nimbusBuildKeyFact(answer, q);

  if (nimbusIsCreativeWritingPrompt(q)) {
    const answerStructure = nimbusBuildAnswerStructure(answer, q);
    let writingTip = nimbusExtractScaffoldSource(answer, 'NIMBUS_KEY_FACT_SOURCE')
      .replace(/\s+/g, ' ').trim();
    if (!writingTip) writingTip = 'Use sensory details and a clear sequence to bring your ideas alive.';
    writingTip = writingTip.split(/\s+/).slice(0, 14).join(' ').replace(/[,:;\-]+$/, '');
    if (!/[.!?]$/.test(writingTip)) writingTip += '.';
    return [
      'Keywords: ' + keywords.join(', '),
      '',
      'Answer Structure: ' + answerStructure,
      '',
      'Example Answer (starter): ' + exampleAnswer,
      '',
      'Writing Tip: ' + writingTip
    ].join('\n').trim();
  }

  if (nimbusIsShortAnswerQuestion(q)) {
    return [
      'Keywords: ' + keywords.join(', '),
      '',
      'Hint: ' + nimbusBuildShortHint(answer, q),
      '',
      'Example Answer (starter): ' + exampleAnswer,
      '',
      'Key Fact: ' + keyFact
    ].join('\n').trim();
  }

  const answerStructure = nimbusBuildAnswerStructure(answer, q);

  return [
    'Keywords: ' + keywords.join(', '),
    '',
    'Answer Structure: ' + answerStructure,
    '',
    'Example Answer (starter): ' + exampleAnswer,
    '',
    'Key Fact: ' + keyFact
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
    safetySettings: GEMINI_STUDENT_SAFETY,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: 'minimal' }
    }
  };

  // Gemini 2.5 does not share every Gemini 3 thinkingConfig setting.
  if (model.startsWith('gemini-2.5')) delete payload.generationConfig.thinkingConfig;

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
    return 'Nimbus is an educational-focused AI project built manually by Abdul Haadi Hassan, its founder. The project is designed around student learning: concise educational guidance, topic-specific writing keywords, saved conversations, and critical thinking. Nimbus is an independent educational AI platform.';
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
  // Forward topic only. The actual image endpoint applies a visual-only prompt
  // to ALL requests, including those made directly from Learning Studio.
  const topic=String(question||'').replace(/\/visual\b/gi,'').trim().slice(0,450);
  return {kind:'diagram',prompt:topic};
}

function nimbusPreviousUserTopic(body) {
  const raw = Array.isArray(body?.history)
    ? body.history
    : (Array.isArray(body?.messages) ? body.messages : []);

  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const item = raw[i];
    if (normalizeRole(item) !== 'user') continue;

    let text = normalizeMessageText(item);
    text = removeVisualCommand(text);
    if (!text) continue;

    if (typeof nimbusCleanWrittenQuestion === 'function') {
      text = nimbusCleanWrittenQuestion(text) || text;
    }

    if (text && text.toLowerCase() !== '/visual') return text;
  }

  return '';
}

export default async function handler(req, res) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Nimbus-Request-ID', requestId);

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, reply: 'Method Not Allowed', request_id: requestId });
  }

  if (!allowedOrigin(req)) return res.status(403).json({ok:false,error_code:'INVALID_ORIGIN'});
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

    const reservation=await reserveRpd(req,res,body);
    if(!reservation.ok)return res.status(reservation.http).json({ok:false,error_code:reservation.error_code,usage:reservation.usage||null,reply:reservation.http===401?'Please sign in to Nimbus.':'Daily usage limit or request validation error.'});
    const billed=reservation.usage;
    res.setHeader('X-Nimbus-Used',String(billed.used));
    res.setHeader('X-Nimbus-Cost',String(billed.cost));
    // Validate the *direct request* before routing to visuals, an LLM, or learning logic.
    const rejected = safetyReview(rawText, 'chat');
    if (rejected) return res.status(200).json({ok:true,reply:rejected.reply,question_type:'safety',error_code:rejected.code,auto_visual:false,visual:null,request_id:requestId});
    const visualRequested = false; // V34.4: visuals are disabled at the server
    const visualText = removeVisualCommand(rawText);
    const standaloneVisualOnly = hasVisualCommand(rawText) && !visualText;
    const previousVisualTopic = standaloneVisualOnly ? nimbusPreviousUserTopic(body) : '';
    const userText = visualText || previousVisualTopic || rawText;

    if (standaloneVisualOnly) return res.status(200).json({ok:true,reply:'Visual generation is currently disabled. I can help with written study hints instead.',auto_visual:false,visual:null,question_type:'visual_disabled',request_id:requestId});
    if(numericMathRequest(userText))return res.status(200).json({ok:true,reply:'Nimbus helps with mathematical vocabulary and concepts, not numerical calculations. Ask about a term, property, or geometry idea.',question_type:'math_vocabulary',auto_visual:false,visual:null,limit:DAILY_LIMIT,request_id:requestId});
    if (standaloneVisualOnly) {
      const visualTopic = previousVisualTopic || 'the previous study topic';
      const badVisual = safetyReview(visualTopic,'visual');
      if (badVisual) return res.status(200).json({ok:true,reply:badVisual.reply,question_type:'safety',error_code:badVisual.code,auto_visual:false,visual:null,request_id:requestId});
      return res.status(200).json({
        ok: true,
        reply: '',
        visual_only: true,
        question_type: 'visual_only',
        auto_visual: true,
        visual: visualPayload(visualTopic, ''),
        model: body.model || 'ror',
        backend_model: 'visual-router',
        source_status: 'local',
        sources: [],
        limit: DAILY_LIMIT,
        request_id: requestId
      });
    }
    // V34.6.2: no generic topic packs. One model-generated, validated
    // scaffold per question, including the first "Help me write" request.
    const explicitWriting = hasWrittenAnswerIntent(userText);
    const activeTaskMode = normalizeTaskMode(body?.task_mode);
    const autoAcademic = nimbusShouldScaffoldAcademic(userText);
    const oldSubject = guidedEducation(userText, body)?.subject || '';
    const academicStart = /^(?:help me write (?:this|an?) answer\s*[:.-]?\s*)?(?:what|who|how|why|when|where|which|explain|describe|compare|define|discuss)\b/i.test(userText);
    const notAcademicTask = ['quiz','study_plan','study_file'].includes(activeTaskMode);
    const projectQuestion = /\b(nimbus|beams|bisc|ilap|learner agency paradigm|beaconhouse)\b/i.test(userText);
    const writtenAnswerRequest = !notAcademicTask && !projectQuestion &&
      (Boolean(oldSubject) || explicitWriting || autoAcademic || academicStart);
    if (writtenAnswerRequest) {
      if(numericMathRequest(userText))return res.status(200).json({ok:true,reply:'Nimbus focuses on mathematical vocabulary and concepts, not numerical answers. Ask me about a mathematical term or geometry idea.',question_type:'math_vocabulary',auto_visual:false,visual:null,limit:DAILY_LIMIT,request_id:requestId});
      try {
        const dyn=await generateDynamicGuide({question:userText,history:Array.isArray(body.history)?body.history:[],apiKey,model:body.model==='legacy'?FALLBACK_MODEL:PRIMARY_MODEL,safetySettings:GEMINI_STUDENT_SAFETY});
        if(!safeGeneratedText(dyn.reply))return res.status(200).json({ok:true,reply:'Nimbus can help you explore a safer learning topic.',question_type:'safety',auto_visual:false,visual:null,request_id:requestId});
        return res.status(200).json({ok:true,reply:dyn.reply,question_type:'educational',education_subject:dyn.subject,backend_model:'topic-aware-guide',auto_visual:false,visual:null,limit:DAILY_LIMIT,request_id:requestId});
      } catch (error) {
        console.error('[Nimbus guide]',requestId,error?.message||'model unavailable');
        return res.status(200).json({ok:false,reply:'Nimbus could not prepare a topic-specific guide right now. Please retry shortly.',error_code:'GUIDE_TEMPORARILY_UNAVAILABLE',auto_visual:false,visual:null,limit:DAILY_LIMIT,request_id:requestId});
      }
    }
    const taskMode = writtenAnswerRequest
      ? ''
      : (activeTaskMode || inferTaskMode(userText));
    const questionType = classifyQuestion(userText, taskMode);
    const modelUserText = writtenAnswerRequest
      ? nimbusBuildWrittenSourcePrompt(userText)
      : (taskMode ? taskModeInstruction(taskMode, userText) : userText);
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

    const requestedModel = body.model === 'legacy' ? FALLBACK_MODEL : PRIMARY_MODEL;
    let data = null;
    let usedModel = requestedModel;
    let sourceStatus = science ? (SCIENCE_STORE_NAME ? 'requested' : 'not_configured') : 'not_requested';
    let firstError = null;

    try {
      data = await requestGemini({
        apiKey,
        model: requestedModel,
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
            model: requestedModel,
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

      // Retry only errors that may be model-specific (busy, timeout or transient failures).
      // Stop on bad requests, rejected credentials and billing restrictions.
      const retryable = err => err?.name === 'AbortError' || [404,429,500,502,503,504].includes(Number(err?.status || 0));
      if (!data && retryable(firstError)) {
        const candidates = [...new Set([requestedModel === PRIMARY_MODEL ? FALLBACK_MODEL : PRIMARY_MODEL, THIRD_MODEL].filter(Boolean))].filter(m => m !== requestedModel).slice(0, 2);
        for (const alternative of candidates) {
          try {
            data = await requestGemini({
              apiKey,
              model: alternative,
              body,
              currentUserText: modelUserText,
              science: false,
              useFileSearch: false,
              timeoutMs: FALLBACK_TIMEOUT_MS
            });
            usedModel = alternative;
            break;
          } catch (nextError) {
            firstError = nextError;
            if (!retryable(nextError)) break;
          }
        }
      }
    }

    if (!data) {
      const code = errorCode(firstError);
      console.error('[Nimbus chat]', requestId, code, firstError?.message || 'model request failed');
      return res.status(200).json({
        ok: false,
        reply: code === 'MODEL_RATE_LIMIT' ? 'Nimbus is busy at the moment. Please retry shortly.' : code === 'MODEL_TIMEOUT' ? 'Nimbus took too long to respond. Please try again.' : 'Nimbus could not reach its chat model right now. Please try again later.',
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

    if (!safeGeneratedText(answer)) {
      return res.status(200).json({ok:true,reply:'Nimbus can help with a safe, age-appropriate alternative.',question_type:'safety',error_code:'UNSAFE_MODEL_OUTPUT',auto_visual:false,visual:null,request_id:requestId});
    }
    if (questionType === 'educational') {
      // If an uncommon question reaches this branch, do not return canned keywords.
      try {
        const dyn=await generateDynamicGuide({question:userText,history:Array.isArray(body.history)?body.history:[],apiKey,model:usedModel,safetySettings:GEMINI_STUDENT_SAFETY});
        answer=dyn.reply;
      } catch {
        answer='Nimbus could not create a topic-specific learning guide right now. Please retry.';
      }
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
