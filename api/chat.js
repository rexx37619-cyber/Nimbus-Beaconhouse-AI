const MODEL_CHAINS = {
  ror: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  legacy: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']
};
const VISUAL_MARKER = /\[NIMBUS_VISUAL\]([\s\S]*?)\[\/NIMBUS_VISUAL\]/i;
const SYSTEM = `
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
VISUAL / GAME SUPPORT:
ACADEMIC OUTPUT MODE:
- For school answers, notes, assignments, essays, or paragraph-writing requests, give keywords, factual points, definitions, sequences, labels, and structure only. Do not write a ready-to-submit paragraph for the student.
- If the student asks Nimbus to rephrase or rewrite prose for them, say exactly: "You have to rephrase it on your own." Then provide only the information, keywords, structure, key facts, and a flow/diagram plan they can use to rephrase it themselves.
- For diagram/flowchart requests, keep the text to concise keywords/labels and generate the visual automatically when the image service is available.
- Do not use markdown tables for the main response unless the user asks for a table.
VISUAL / NIMBUS 3.1 LOR IMAGE:
- Add a [NIMBUS_VISUAL] block only for genuine academic/educational questions (school subjects, study, homework, lessons, science, maths, academic processes) when a diagram would help. Never add it for greetings, casual chat, or Beaconhouse-specific questions such as book lists, competitions, campuses, official links, BEAMS, LAP, or other school-information requests.
- Inside it use four plain lines only: type: diagram|flowchart|keywords, title: ..., keywords: ..., prompt: ...
- The prompt should ask for one diagram only and should stay concise; the image model is Nimbus 3.1 Lor Image.
- For educational programming or technical-learning questions, a visual block may be included when it genuinely helps; do not generate visuals for ordinary coding/debugging requests unless the user is clearly asking for a teaching diagram.
- Do not add a visual block to routine factual answers where it is not useful.
PRIVACY:
- Never claim access to private grades, attendance, passwords, student records, BEAMS accounts or internal school systems.
- Never ask for passwords.
ERROR STYLE:
- Never expose provider errors, stack traces or API diagnostics.
- If a model path fails, give a short neutral answer and invite the user to retry.
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
  return { text: String(text || '').replace(match[0], '').trim(), visual };
}
async function requestGemini(model, apiKey, parts) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: 2200 } })
  });
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: 'Method Not Allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: 'Nimbus is temporarily busy. Please try again in a moment.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const parts = [];
    const attachment = body?.attachment;
    if (attachment?.data && attachment?.mimeType) {
      const supported = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
      if (!supported.includes(attachment.mimeType)) return res.status(400).json({ message: 'Supported attachments: PDF, PNG, JPG, WEBP and TXT.' });
      parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    }
    parts.push({ text: String(body?.message || '').trim() || (attachment?.name ? `Please analyse the attached file "${attachment.name}" and help the student.` : 'Hello!') });
    const chain = MODEL_CHAINS[body?.model] || MODEL_CHAINS.ror;
    let lastError = null;
    for (const model of chain) {
      try {
        const response = await requestGemini(model, apiKey, parts);
        const data = await response.json();
        if (response.ok) {
          const raw = (data?.candidates?.[0]?.content?.parts || []).filter(p => typeof p.text === 'string').map(p => p.text).join('') || 'I’m ready. What would you like to learn?';
          const parsed = stripVisual(raw);
          return res.status(200).json({ reply: cleanNimbusText(parsed.text), visual: parsed.visual, model: body?.model || 'ror', limit: Number(process.env.NIMBUS_DAILY_LIMIT || 1500) });
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
