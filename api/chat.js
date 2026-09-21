import { GoogleGenAI } from '@google/genai';

const MODEL_CHAINS = {
  ror: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  legacy: ['gemini-3.1-flash-lite']
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
- For school answers, notes, assignments, essays, or paragraph-writing requests, give keywords, factual points, definitions, sequences, labels, and structure only. Do not write a ready-to-submit paragraph for the student.
- For Grade 7 science questions, prefer this compact structure when relevant:
  Keywords: ...
  Key function(s): ...
  Key fact(s): ...
  Answer structure: ...
- Keep explanations simple enough for a Grade 7 Beaconhouse student.
- Do not copy long passages from a textbook. Paraphrase in your own words.
- For a source-grounded science question, do not invent missing details. Say when the indexed source does not contain enough information.
- If the student asks for a rewrite, say exactly: "You have to rephrase it on your own." Then provide only information, keywords, structure, key facts, and a diagram plan.
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
      generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' }, maxOutputTokens: 2200 }
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
      input: memoryText,
      tools: [{ type: 'file_search', file_search_store_names: [SCIENCE_STORE_NAME] }],
      generation_config: { temperature: 0.2, maxOutputTokens: 1800 },
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

function sourceNote(sources) {
  if (!Array.isArray(sources) || !sources.length) return '';
  const labels = sources.slice(0, 3).map(s => s.pageNumber ? `${s.fileName} • p. ${s.pageNumber}` : s.fileName);
  return `\n\nSource: ${labels.join(' | ')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });
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
    parts.push({ text: requestedAttachment?.name ? `${memoryText}\n\nPlease analyse the attached file \"${requestedAttachment.name}\" and help the student.` : memoryText });

    const chain = MODEL_CHAINS[body?.model] || MODEL_CHAINS.ror;

    if (scienceQuery && !requestedAttachment) {
      for (const ragModel of chain) {
        const rag = await requestScienceRag(apiKey, ragModel, userText, memoryText);
        if (rag?.text) {
          const parsedText = beaconhouseQuery ? `${rag.text}\n${BEACONHOUSE_CONTEXT}` : rag.text;
          const finalReply = cleanNimbusText(parsedText);
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
          const finalReply = cleanNimbusText(parsed.text);
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
        if (!(response.status === 429 || response.status >= 500)) break;
      } catch (e) { lastError = e?.message || 'network error'; }
    }
    console.error('Nimbus upstream error', lastError);
    return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });
  } catch (e) {
    console.error('Nimbus function error', e);
    return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });
  }
}
