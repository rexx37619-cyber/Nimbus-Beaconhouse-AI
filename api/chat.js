import { GoogleGenAI } from '@google/genai';

const MODEL_CHAINS = {
  // Fast primary path. 3.5 Flash-Lite is the current GA fast/cost-efficient model.
  // 2.5 Flash-Lite is the compatibility fallback so a transient 429/5xx does not
  // surface a 'temporarily busy' response to students.
  ror: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'],
  legacy: ['gemini-2.5-flash-lite']
};
const VISUAL_MARKER = /\[NIMBUS_VISUAL\]([\s\S]*?)\[\/NIMBUS_VISUAL\]/i;
const SCIENCE_STORE_NAME = String(process.env.NIMBUS_SCIENCE_STORE || '').trim();

const BEACONHOUSE_OFFICIAL_LINKS = [
  ['Beaconhouse main site','https://www.beaconhouse.net/'],
  ['Academics','https://www.beaconhouse.net/academic/'],
  ['Academic archive','https://www.beaconhouse.net/academic-programs/'],
  ['Clubs & Societies','https://www.beaconhouse.net/clubs-and-societies/'],
  ['Learner Profile','https://www.beaconhouse.net/beaconhouse-learner-profile/'],
  ['Sports competitions','https://www.beaconhouse.net/sports-competition/'],
  ['STEAM competitions','https://www.beaconhouse.net/steam-competition/'],
  ['BISC','https://bisc.beaconhouse.net/'],
  ['BISC About','https://bisc.beaconhouse.net/about-bisc/'],
  ['RISE','https://rise.beaconhouse.net/'],
  ['BEAMS','https://beams.beaconhouse.net/home/'],
  ['BEAMS PRISM','https://beams.beaconhouse.net/prism/'],
  ['LAP','https://lap.beaconhouse.net/about-us/'],
  ['LAP guidelines','https://lap.beaconhouse.net/guidelines-2/'],
  ['BOSS','https://boss.beaconhouse.net/about-us/'],
  ['Beaconhouse book-list portal','https://booklist.beaconhouse.net/'],
  ['2026–27 Sindh & Balochistan book lists','https://booklist.beaconhouse.net/sindh-balochistan-booklist/'],
  ['Class 7 Sindh & Balochistan book list','https://booklist.beaconhouse.net/booklist/2025/sindh-balochistan/class7/'],
  ['2026–27 Punjab book lists','https://booklist.beaconhouse.net/punjab-booklist/'],
  ['2026–27 KPK book lists','https://booklist.beaconhouse.net/kpk-booklist/'],
  ['2026–27 ICT book lists','https://booklist.beaconhouse.net/ict-booklist/']
];

const BEACONHOUSE_CONTEXT = `
Beaconhouse public-information grounding:
When a question is specifically about Beaconhouse, use only the official public references listed below. Do not claim access to private school systems, BEAMS accounts, grades, attendance, student records, passwords, or internal documents. Do not invent campus-specific rules. Treat current book-list pages as regional/campus-specific public references.
${BEACONHOUSE_OFFICIAL_LINKS.map(([name,url]) => `- ${name}: ${url}`).join('\n')}
`;

const BASE_SYSTEM = `
You are Nimbus, a rapid educational AI assistant for students.
Identity:
- Nimbus was founded and developed by Abdul Haadi Hassan.
- Nimbus is a student-built educational AI project with a Beaconhouse-focused knowledge layer.
- Do not claim Beaconhouse officially owns or endorses Nimbus unless an official source supports that claim.
- If asked what powers Nimbus, say: Nimbus is powered by a Google model with custom Nimbus modifications.
- Never claim Nimbus was trained by Google or created by Google.
STYLE:
- Be useful, direct, friendly and quick.
- In normal prose, never use double-asterisk bold markers.
- Do not use Markdown heading syntax with # characters in normal prose.
- Plain paragraphs, short labels, numbered steps and simple bullets are preferred.
- Never write filler like "Connecting to Nimbus" or "waiting for the backend".
CODING:
- When code is requested, ALWAYS put every code sample in fenced Markdown with a real language identifier.
- Examples: python, javascript, html, css, lua, java, cpp, csharp, powershell, json.
- Explain the code outside the fence.
ACADEMIC OUTPUT MODE:
- For school answers, notes, assignments, essays, or paragraph-writing requests, do NOT write a ready-to-submit paragraph. Give study material only.
- Use ONLY these sections when appropriate: Keywords, Key function(s), Answer structure, Key fact(s). Do not add an extra explanation paragraph.
- Keywords: compact terms only, not sentences.
- Key function(s): use only when the question asks what a structure/process does; keep it to short fragments.
- Answer structure: 2–4 very short ordered fragments or labels that show how the student should organize their own answer.
- Key fact(s): each fact must contain 4–8 content words, not a full polished sentence. Shuffle the word order slightly so the student must rephrase it in their own words.
- Keep Grade 7 science wording simple enough for a Beaconhouse student.
- Use the indexed textbook as the primary source when it contains the topic, then add only a small amount of clearly model-generated supporting knowledge when useful. Never pretend model-generated facts came from the textbook.
- Do not copy long passages from the textbook. Paraphrase in your own words.
- If the student asks for a rewrite, say exactly: "You have to rephrase it on your own." Then give only keywords, short structure, 4–8-word shuffled key facts, and a diagram plan.
VISUALS:
- When a diagram, labelled scientific structure, process, flowchart, or concept map would genuinely help, add exactly one [NIMBUS_VISUAL] block at the end.
- Inside it use four plain lines only: type: diagram|flowchart|keywords, title: ..., keywords: ..., prompt: ...
- Keep labels concise and scientifically meaningful.
PRIVACY:
- Never ask for passwords.
- Never claim private school-system access.
ERROR STYLE:
- Never expose provider errors, stack traces or API diagnostics.
- If a model path fails, give a short neutral answer and invite the student to retry.
`;

const SCIENCE_SYSTEM = `
GRADE 7 SCIENCE SOURCE MODE:
- A persistent Gemini File Search store may contain the two user-supplied Lower Secondary Grade 7 science PDF parts.
- When File Search returns relevant material, treat it as the primary source for science answers.
- Preserve the source's concepts and terminology, but explain in simpler original wording.
- Prefer keywords, definitions, functions, examples, labelled relationships and short cause/effect sequences over long prose.
- For anatomy or systems, use "Key function(s)" only when the question is about what a structure does.
- Never invent a textbook page number or citation. Use citations supplied by File Search only.
`;

function cleanNimbusText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .trim();
}

function stripVisual(text) {
  const source = String(text || '');
  const match = source.match(VISUAL_MARKER);
  if (!match) {
    const openIndex = source.indexOf('[NIMBUS_VISUAL]');
    if (openIndex !== -1) {
      const block = source.slice(openIndex + '[NIMBUS_VISUAL]'.length).trim();
      const lines = block.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const visual = {};
      for (const line of lines) {
        const i = line.indexOf(':');
        if (i > -1) visual[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      return { text: source.slice(0, openIndex).trim(), visual: Object.keys(visual).length ? visual : null };
    }
    return { text: source, visual: null };
  }
  const lines = match[1].trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  const visual = {};
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i > -1) visual[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { text: source.replace(match[0], '').trim(), visual };
}

function looksLikeScience(text) {
  const s = String(text || '').toLowerCase();
  return /\b(science|biology|chemistry|physics|ecosystem|food chain|food web|habitat|adaptation|cell|tissue|organ|skeleton|joint|muscle|respiration|respiratory|digestion|photosynthesis|reproduction|forces?|motion|energy transfer|electricity|circuit|acid|base|particle|matter|mixture|solution|density|pressure|heat|temperature|light|sound|magnet|atom|molecule|nutrition|gas exchange|diffusion|asthma)\b/i.test(s);
}

function looksLikeBeaconhouse(text) {
  const s = String(text || '').toLowerCase();
  return /\b(beaconhouse|bh\.edu\.pk|beams|bisc|rise|lap|boss|book ?list|booklist|learner profile|access centre|steam competition|sports competition)\b/i.test(s);
}

function collectFileSources(interaction) {
  const out = [];
  for (const step of interaction?.steps || []) {
    if (step?.type !== 'model_output') continue;
    for (const block of step?.content || []) {
      for (const ann of block?.annotations || []) {
        if (ann?.type === 'file_citation') {
          out.push({
            fileName: ann.file_name || 'Grade 7 science source',
            source: ann.source || null,
            pageNumber: Number.isFinite(Number(ann.page_number)) ? Number(ann.page_number) : null
          });
        }
      }
    }
  }
  return out.filter((s, i, arr) => arr.findIndex(x => x.fileName === s.fileName && x.source === s.source && x.pageNumber === s.pageNumber) === i);
}

async function requestGemini(model, apiKey, parts, systemText) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' }, maxOutputTokens: 900 }
    })
  });
}

async function requestScienceRag(apiKey, model, userText, memoryText) {
  if (!SCIENCE_STORE_NAME) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model,
      system_instruction: `${BASE_SYSTEM}\n${SCIENCE_SYSTEM}\n${BEACONHOUSE_CONTEXT}`,
      input: academicCompactPrompt(userText, memoryText, 'The indexed book is the preferred source when relevant.'),
      tools: [{ type: 'file_search', file_search_store_names: [SCIENCE_STORE_NAME] }],
      generation_config: { maxOutputTokens: 900, thinking_level: 'minimal' },
      store: false
    });
    const raw = interaction?.output_text || '';
    if (!raw.trim()) return null;
    return { ...stripVisual(raw), sources: collectFileSources(interaction) };
  } catch (e) {
    console.warn('[Nimbus science RAG] unavailable:', e?.message || e);
    return null;
  }
}


function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(m => m && (m.role === 'user' || m.role === 'ai') && typeof m.text === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, text: m.text.slice(0, 6000) }));
}

function buildConversationMemory(history, currentText) {
  const items = normalizeHistory(history);
  const lines = items.map(m => `${m.role === 'user' ? 'Student' : 'Nimbus'}: ${m.text}`);
  lines.push(`Student: ${currentText}`);
  return `Conversation memory for this chat:\n${lines.join('\n')}`;
}

function isScienceExplanation(text) {
  if (!looksLikeScience(text)) return false;
  const s = String(text || '').toLowerCase();
  return /\b(explain|explanation|how does|how do|why does|why do|describe|what is|what are|how it works|function|functions|difference between|compare|process|steps|structure|role of)\b/i.test(s);
}

function autoScienceVisual(userText, answerText) {
  return {
    type: /difference between|compare/i.test(userText) ? 'comparison' : /process|steps|how does|how do/i.test(userText) ? 'process' : 'scientific illustration',
    title: String(userText || 'Grade 7 science visual').slice(0, 70),
    keywords: 'scientific subject • key relationships • concise labels',
    prompt: `Create a polished, artistic Grade 7 science visual for this explanation. Do NOT make four generic boxes, a flowchart template, a poster, or a text-heavy infographic. Choose the visual form that best matches the science: realistic anatomy/cutaway for structures, a clean laboratory setup for experiments, a physically accurate staged process for processes, or a comparison plate for differences. Use a strong central subject, dimensional depth, subtle educational lighting, clean arrows/leader lines only where useful, and very short labels. Favor visual storytelling over blocks of text. Use only facts supported by the answer. Topic: ${String(userText || '').slice(0,1400)}. Nimbus answer context: ${String(answerText || '').slice(0,3000)}.`
  };
}


function academicCompactPrompt(userText, memoryText, sourceHint='') {
  return `${memoryText}

STUDENT OUTPUT CONTRACT:
- Give study material only; never a ready-to-submit paragraph.
- Output only the useful sections below, in this order, and omit sections that do not apply:
  Keywords: short terms
  Key function(s): short fragments only when relevant
  Answer structure: 2-4 short ordered fragments
  Key fact(s): 4-8 content words per fact, with word order slightly shuffled
- A Key fact must NOT be a polished sentence. Example style only: "downward diaphragm contracts air".
- The student must rephrase the material themselves.
- Use the indexed Grade 7 science book first when relevant. Add a small amount of your own general knowledge only where helpful, and never label model knowledge as book content.
- Keep it simple, accurate, and fast.
- Do not mention internal models, API errors, retries, providers, or backend systems.
${sourceHint}
Current student request: ${userText}`;
}

function enforceShuffledKeyFacts(text) {
  const lines = String(text || '').split(/\r?\n/);
  let inFacts = false;
  return lines.map(line => {
    const trimmed = line.trim();
    const factHeader = trimmed.match(/^key fact\(?s?\)?:\s*(.*)$/i);
    if (factHeader) {
      inFacts = true;
      const inline = factHeader[1].trim();
      if (!inline) return 'Key fact(s):';
      return `Key fact(s):\n- ${shuffleFactWords(inline)}`;
    }
    if (inFacts && /^(Keywords?|Key function|Answer structure|Source):/i.test(trimmed)) {
      inFacts = false;
      return line;
    }
    if (inFacts && trimmed) {
      const prefix = trimmed.replace(/^[-•\d.)\s]+/, '').replace(/[.?!]+$/,'');
      if (!prefix) return line;
      return `- ${shuffleFactWords(prefix)}`;
    }
    return line;
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function shuffleFactWords(value) {
  let words = String(value || '').split(/\s+/).map(w => w.replace(/^[^\w]+|[^\w]+$/g, '')).filter(Boolean);
  if (words.length > 8) words = words.slice(0, 8);
  if (words.length >= 4) {
    for (let i = words.length - 1; i > 0; i--) {
      const j = (words.join('').length + i * 17) % (i + 1);
      [words[i], words[j]] = [words[j], words[i]];
    }
  }
  return words.join(' ');
}

function sourceNote(sources) {
  if (!Array.isArray(sources) || !sources.length) return '';
  const labels = sources.slice(0, 3).map(s => s.pageNumber ? `${s.fileName} • p. ${s.pageNumber}` : s.fileName);
  return `\n\nSource: ${labels.join(' | ')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'Keywords: Nimbus study mode\nAnswer structure: question → key points → rephrase\nKey fact(s): add your own study words', transient: true });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userText = String(body?.message || '').trim() || 'Hello!';
    const history = normalizeHistory(body?.history);
    const memoryText = buildConversationMemory(history, userText);
    const scienceQuery = looksLikeScience(userText);
    const scienceExplanation = isScienceExplanation(userText);
    const beaconhouseQuery = looksLikeBeaconhouse(userText);

    const requestedAttachment = body?.attachment;
    const parts = [];
    if (requestedAttachment?.data && requestedAttachment?.mimeType) {
      const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
      if (!supported.includes(requestedAttachment.mimeType)) return res.status(400).json({ message: 'Supported attachments: PDF, PNG, JPG, WEBP and TXT.' });
      parts.push({ inlineData: { mimeType: requestedAttachment.mimeType, data: requestedAttachment.data } });
    }
    parts.push({ text: requestedAttachment?.name ? academicCompactPrompt(userText, memoryText, `Analyse the attached file ${requestedAttachment.name} for useful evidence.`) : academicCompactPrompt(userText, memoryText) });

    const chain = MODEL_CHAINS[body?.model] || MODEL_CHAINS.ror;

    if (scienceQuery && !requestedAttachment) {
      for (const ragModel of chain) {
        const rag = await requestScienceRag(apiKey, ragModel, userText, memoryText);
        if (rag?.text) {
          const parsedText = beaconhouseQuery ? `${rag.text}\n${BEACONHOUSE_CONTEXT}` : rag.text;
          const finalReply = enforceShuffledKeyFacts(cleanNimbusText(parsedText));
          return res.status(200).json({
            reply: finalReply + sourceNote(rag.sources),
            visual: rag.visual || (scienceExplanation ? autoScienceVisual(userText, finalReply) : null),
            auto_visual: Boolean(scienceExplanation),
            sources: rag.sources,
            model: body?.model || 'ror',
            limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500),
            grounded: true
          });
        }
      }
    }

    let lastError = null;
    for (const model of chain) {
      try {
        const systemText = `${BASE_SYSTEM}\n${beaconhouseQuery ? BEACONHOUSE_CONTEXT : ''}`;
        const response = await requestGemini(model, apiKey, parts, systemText);
        const data = await response.json();
        if (response.ok) {
          const raw = (data?.candidates?.[0]?.content?.parts || []).filter(p => typeof p.text === 'string').map(p => p.text).join('') || 'I’m ready. What would you like to learn?';
          const parsed = stripVisual(raw);
          const finalReply = enforceShuffledKeyFacts(cleanNimbusText(parsed.text));
          return res.status(200).json({
            reply: finalReply,
            visual: parsed.visual || (scienceExplanation ? autoScienceVisual(userText, finalReply) : null),
            auto_visual: Boolean(scienceExplanation),
            model: body?.model || 'ror',
            limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500),
            grounded: false
          });
        }
        lastError = data?.error?.message || `HTTP ${response.status}`;
        if (!(response.status === 408 || response.status === 429 || response.status >= 500)) break;
      } catch (e) { lastError = e?.message || 'network error'; }
    }
    console.warn('Nimbus upstream path exhausted; returning a neutral retry-safe response.', lastError);
    return res.status(200).json({
      reply: 'Keywords: topic-based study points\nAnswer structure: retry the same question\nKey fact(s): short study response unavailable',
      model: body?.model || 'ror',
      limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500),
      grounded: false,
      transient: true
    });
  } catch (e) {
    console.warn('Nimbus function recovered from an upstream exception.', e?.message || e);
    return res.status(200).json({
      reply: 'Keywords: study topic\nAnswer structure: key points → functions → fact\nKey fact(s): rephrase these words yourself',
      model: body?.model || 'ror',
      limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500),
      grounded: false,
      transient: true
    });
  }
}
