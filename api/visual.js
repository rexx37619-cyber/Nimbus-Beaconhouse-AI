const CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

function isCasualMessage(text) {
  return /^(?:hi|hi nimbus|hello|hello nimbus|hey|hey nimbus|yo|sup|what'?s up|how are you|how are u|good morning|good afternoon|good evening|good night|thanks|thank you|thx|ok|okay|k|bye|goodbye|who are you|what can you do|tell me a joke)[!.?\s]*$/i.test(String(text || '').trim());
}

function isBeaconhouseQuestion(text) {
  const s = String(text || '').toLowerCase();
  return /\bbeaconhouse\b|\bbisc\b|\bbeams\b|\bprism\b|\brise\b|\blap\b|\bboss\b|\bbook\s*list\b|\bbooklist\b|\bcampus\b|\badmissions?\b|\bcompetition\b|\blearner\s+profile\b|\baccess\s+centre\b|\bclubs?\s+(?:and|&)\s+societies\b/i.test(s);
}

function looksLikeScience(text) {
  return /\b(?:science|biology|chemistry|physics|ecosystem(?:s)?|food\s+chain|water\s+cycle|carbon\s+cycle|nitrogen\s+cycle|food\s+web|habitat(?:s)?|cell(?:s)?|tissue(?:s)?|organ(?:s)?|skeleton(?:s)?|joint(?:s)?|muscle(?:s)?|respiration|breathing|lung(?:s)?|heart|circulation|digestion|enzyme(?:s)?|photosynthesis|diaphragm|reproduction|force(?:s)?|energy|electricity|circuit(?:s)?|atom(?:s)?|molecule(?:s)?|matter|acid(?:s)?|base(?:s)?|reaction(?:s)?|planet(?:s)?|climate|weather|light|sound|wave(?:s)?|magnet(?:s)?|heat|temperature|density|pressure|friction|gravity|evaporation|condensation|diffusion|aerobic|anaerobic)\b/i.test(String(text || ''));
}

function hasAcademicSubject(text) {
  return /\b(?:math|maths|algebra|arithmetic|geometry|equation(?:s)?|fraction(?:s)?|percentage(?:s)?|ratio(?:s)?|statistics|probability|mean|median|mode|english|grammar|writing|literature|poetry|reading|noun(?:s)?|verb(?:s)?|adjective(?:s)?|adverb(?:s)?|sentence(?:s)?|paragraph(?:s)?|history|geography|civics|map(?:s)?|culture|civilization|revolution|empire|ancient|medieval|timeline|computer\s+science|ict|coding|programming|algorithm(?:s)?|biology|chemistry|physics|science|water\s+cycle|carbon\s+cycle|nitrogen\s+cycle|solar\s+system|planet(?:s)?|homework|schoolwork|exam|revision|lesson|chapter|class\s*\d+|grade\s*\d+)\b/i.test(String(text || ''));
}

function hasEducationalIntent(text) {
  return /\b(?:explain|explanation|describe|define|definition|what\s+is|what\s+are|what\s+does|what\s+do|how\s+does|how\s+do|why\s+does|why\s+do|difference\s+between|compare|comparison|function\s+of|purpose\s+of|types?\s+of|how\s+it\s+works?|teach\s+me|learn\s+about|lesson|concept|process|steps?|sequence|example|diagram|label(?:led)?|flowchart|solve|calculate|find|prove|derive|revise|revision|study|notes)\b/i.test(String(text || ''));
}

function looksLikeMathProblem(text) {
  const s = String(text || '');
  return /(?:\d|x|y)\s*(?:[+\-*/^=]|÷|×)|\b(?:solve|calculate|find)\b/i.test(s);
}

function isEducationalQuestion(text) {
  const s = String(text || '').trim();
  if (!s || isCasualMessage(s) || isBeaconhouseQuestion(s)) return false;
  const academicContext = hasAcademicSubject(s) || looksLikeScience(s) || looksLikeMathProblem(s) || /\b(?:school|student|classroom|class\s*\d+|grade\s*\d+|homework|schoolwork|exam|lesson|chapter|revision|study|notes|subject)\b/i.test(s);
  return hasEducationalIntent(s) && academicContext;
}

function shouldVisualize(text) {
  return isEducationalQuestion(text);
}

function classifyVisualKind(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(joints?|skeleton|bones?|muscles?|lungs?|heart|cells?|tissues?|organs?|brain|digest|respiration|breathing|reproduction|kidneys?|stomach|intestines?|diaphragm)\b/.test(s)) return 'accurate labelled anatomical or biological illustration';
  if (/\b(circuit|electricity|force|energy|reaction|photosynthesis|food\s+chain|food\s+web|ecosystem|cycle|heat|temperature|diffusion|aerobic|anaerobic)\b/.test(s)) return 'scientific system or process illustration';
  if (/\b(algebra|equation|fraction|geometry|ratio|percentage|probability|statistics)\b/.test(s)) return 'educational mathematics visualization';
  if (/\b(history|geography|map|climate|civilization|empire|timeline)\b/.test(s)) return 'educational history or geography illustration';
  return 'polished educational illustration representing the concept directly';
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'\"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[ch]));
}

function topicFallback(topic) {
  const safeTopic = escapeXml(String(topic || 'Educational visual').slice(0, 70));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="100%" role="img" aria-label="Educational visual fallback"><rect width="1200" height="675" fill="#f7fafc"/><rect x="55" y="45" width="1090" height="585" rx="28" fill="#ffffff" stroke="#d7dee8" stroke-width="3"/><text x="600" y="115" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#18212f">Educational Visual Fallback</text><text x="600" y="155" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#4b5563">${safeTopic}</text><circle cx="600" cy="350" r="112" fill="#eef3f8" stroke="#9aa8b8" stroke-width="4"/><path d="M520 350h160M600 270v160" stroke="#667788" stroke-width="6" stroke-linecap="round"/><text x="600" y="545" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#667085">The image provider was unavailable, so Nimbus kept a topic-specific fallback.</text></svg>`;
}

async function generateCloudflare(prompt) {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !token) {
    const error = new Error('Cloudflare image credentials are not configured');
    error.code = 'MISSING_CLOUDFLARE_ENV';
    throw error;
  }

  const url = `${CLOUDFLARE_API_BASE}/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_MODEL}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: String(prompt || '').slice(0, 2048),
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647)
    })
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 400);
    const error = new Error(`Cloudflare image request failed (${response.status})`);
    error.status = response.status;
    error.preview = errorText;
    throw error;
  }

  if (contentType.includes('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      data: buffer.toString('base64'),
      mimeType: contentType.split(';')[0] || 'image/jpeg'
    };
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Cloudflare returned an unreadable image response');
  }

  const base64 =
    data?.result?.image ||
    data?.image ||
    data?.result?.data ||
    data?.data;

  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Cloudflare response did not contain image data');
  }

  return {
    data: base64,
    mimeType: 'image/jpeg'
  };
}

export function shouldVisualizeForNimbus(text) {
  return shouldVisualize(text);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    body = body || {};

    const originalPrompt = String(body?.prompt || body?.message || '').trim();
    if (!originalPrompt) {
      return res.status(400).json({ ok: false, message: 'Prompt is required.' });
    }

    if (!shouldVisualize(originalPrompt)) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        fallback: false,
        model: 'nimbus-visual-skip',
        message: 'Visual skipped because this is not an educational visual request.'
      });
    }

    const kind = classifyVisualKind(originalPrompt);
    const enhancedPrompt = `Create a high-quality 16:9 ${kind} for a school lesson. Topic: ${originalPrompt}. Make it topic-specific, accurate, visually rich, clear and classroom-ready. Use a strong focal subject, meaningful relationships, concise readable labels, and useful arrows or callouts only where they clarify the idea. Avoid generic four-box diagrams, generic cards, text-only posters, wireframes, empty panels, placeholders, repetitive layouts and vague stock infographic templates. Prefer an actual educational illustration, anatomy cutaway, process diagram, map, timeline or mathematics visualization appropriate to the topic.`;

    try {
      const generated = await generateCloudflare(enhancedPrompt);
      return res.status(200).json({
        ok: true,
        skipped: false,
        fallback: false,
        model: 'flux-1-schnell',
        mimeType: generated.mimeType,
        data: generated.data
      });
    } catch (error) {
      console.error('[Nimbus visual]', error?.message || error);
      return res.status(200).json({
        ok: true,
        skipped: false,
        fallback: true,
        model: 'nimbus-topic-fallback',
        mimeType: 'image/svg+xml',
        svg: topicFallback(originalPrompt),
        message: 'The image provider was unavailable; Nimbus returned a topic-specific fallback.'
      });
    }
  } catch (error) {
    console.error('[Nimbus visual]', error?.message || error);
    return res.status(200).json({
      ok: false,
      message: 'Visual generation could not be completed.'
    });
  }
}
