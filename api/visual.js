function parseBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); } catch { return {}; }
  }
  return req.body || {};
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'\"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

function cleanTopic(prompt) {
  const s = String(prompt || '').replace(/\s+/g, ' ').trim();
  const match = s.match(/User request:\s*(.*?)(?:\.\s*Key answer content:|$)/i);
  const topic = match ? match[1] : s;
  return topic.replace(/Create exactly one educational diagram.*?User request:\s*/i, '').trim().slice(0, 90);
}

function shell(title, subtitle, body, footer='Nimbus Study Visual • Keywords + visual relationships for independent rephrasing') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="100%" role="img" aria-label="${escapeXml(title)}" style="display:block;width:100%;height:auto;border-radius:18px;background:#f7fbff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fbff"/><stop offset="1" stop-color="#eef5ff"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#13233f"/><stop offset="1" stop-color="#2456a6"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#17345f" flood-opacity="0.12"/></filter>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#d9e6f5" stroke-width="1"/></pattern>
    <style>.h{font-weight:800}.b{font-weight:700}.s{fill:#52657d}.ink{fill:#10233f}.line{stroke:#17345f;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.soft{stroke:#9ab1cf;stroke-width:2}</style>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <rect width="1600" height="900" fill="url(#grid)" opacity="0.55"/>
  <rect x="48" y="42" width="1504" height="92" rx="20" fill="url(#navy)" filter="url(#shadow)"/>
  <text x="82" y="82" fill="#8dd0ff" font-size="18" class="h" letter-spacing="2">NIMBUS 3.1 LOR IMAGE • STUDY VISUAL</text>
  <text x="82" y="115" fill="#fff" font-size="34" class="h">${escapeXml(title)}</text>
  <text x="1518" y="92" fill="#d9ebff" font-size="15" class="b" text-anchor="end">DIAGRAM</text>
  <text x="82" y="162" fill="#52657d" font-size="18">${escapeXml(subtitle)}</text>
  ${body}
  <text x="800" y="864" text-anchor="middle" fill="#6f8198" font-size="14">${escapeXml(footer)}</text>
</svg>`;
}

function heartVisual() {
  const body = `
  <g transform="translate(0,20)">
    <rect x="72" y="190" width="340" height="570" rx="26" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="102" y="235" class="ink h" font-size="20">DEOXYGENATED BLOOD</text>
    <path d="M250 280 C190 250 140 320 168 382 C194 442 247 496 250 560 C253 496 306 442 332 382 C360 320 310 250 250 280 Z" fill="#4f83cc" opacity="0.12" stroke="#3f6eb1" stroke-width="5"/>
    <circle cx="205" cy="370" r="46" fill="#4b84d2" opacity="0.85"/><circle cx="295" cy="370" r="46" fill="#cb4a6b" opacity="0.86"/>
    <rect x="176" y="424" width="60" height="105" rx="26" fill="#3674c8" opacity="0.92"/><rect x="264" y="424" width="60" height="105" rx="26" fill="#c93d61" opacity="0.92"/>
    <text x="205" y="375" fill="#fff" font-size="17" class="h" text-anchor="middle">RA</text>
    <text x="295" y="375" fill="#fff" font-size="17" class="h" text-anchor="middle">LA</text>
    <text x="206" y="484" fill="#fff" font-size="16" class="h" text-anchor="middle">RV</text>
    <text x="294" y="484" fill="#fff" font-size="16" class="h" text-anchor="middle">LV</text>
    <text x="250" y="574" fill="#52657d" font-size="14" text-anchor="middle">simplified chamber map</text>
    <path d="M20 330 H155" class="line" marker-end="url(#arrow)"/>
    <text x="22" y="310" class="s" font-size="16">Venae cavae</text>
    <path d="M345 370 H465" class="line"/>
    <path d="M345 380 C395 380 405 330 470 330" class="line"/>
    <path d="M470 330 l-18 -12 M470 330 l-18 12" class="line"/>
    <text x="475" y="300" class="s" font-size="16">Pulmonary artery → lungs</text>

    <rect x="540" y="180" width="900" height="180" rx="24" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="580" y="225" class="ink h" font-size="22">CIRCULATION FLOW</text>
    <g font-size="16" class="h">
      <rect x="580" y="260" width="170" height="56" rx="28" fill="#dceaff"/><text x="665" y="295" text-anchor="middle" fill="#244c88">Vena cava</text>
      <path d="M750 288 H805" class="line"/>
      <rect x="805" y="260" width="170" height="56" rx="28" fill="#d8e5ff"/><text x="890" y="295" text-anchor="middle" fill="#244c88">Right atrium</text>
      <path d="M975 288 H1030" class="line"/>
      <rect x="1030" y="260" width="170" height="56" rx="28" fill="#ecdfff"/><text x="1115" y="295" text-anchor="middle" fill="#6d3ea4">Right ventricle</text>
      <path d="M1200 288 H1255" class="line"/>
      <rect x="1255" y="260" width="150" height="56" rx="28" fill="#ffe2ea"/><text x="1330" y="295" text-anchor="middle" fill="#a53a57">Lungs</text>
    </g>

    <rect x="540" y="392" width="900" height="330" rx="24" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="580" y="438" class="ink h" font-size="22">OXYGENATED BLOOD RETURNS → BODY</text>
    <circle cx="700" cy="560" r="110" fill="#fff" stroke="#a7c8ff" stroke-width="10"/>
    <circle cx="700" cy="560" r="70" fill="#fff0f4" stroke="#e66a8b" stroke-width="8"/>
    <path d="M810 520 C900 470 1000 490 1080 535" class="line"/>
    <path d="M810 600 C900 650 1000 635 1080 585" class="line"/>
    <text x="700" y="565" class="ink h" font-size="20" text-anchor="middle">LUNGS</text>
    <path d="M1090 560 H1270" class="line"/>
    <path d="M1270 560 l-24 -14 M1270 560 l-24 14" class="line"/>
    <rect x="1110" y="500" width="240" height="120" rx="18" fill="#fff7ef" stroke="#f0ba70" stroke-width="2"/>
    <text x="1230" y="545" class="ink h" font-size="20" text-anchor="middle">LEFT HEART</text>
    <text x="1230" y="575" class="s" font-size="16" text-anchor="middle">LA → LV → aorta</text>
    <path d="M1230 622 C1225 680 1080 685 1010 650" class="line"/>
    <text x="1000" y="696" class="s" font-size="16">Aorta → body tissues</text>
  </g>
  <defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 L12 6 L0 12 z" fill="#17345f"/></marker></defs>`;
  return shell('Blood circulation through the human heart', 'Four chambers, pulmonary circuit, and systemic circuit', body);
}

function photosynthesisVisual() {
  const body = `
  <g transform="translate(0,20)">
    <rect x="80" y="220" width="420" height="500" rx="26" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <circle cx="210" cy="340" r="72" fill="#ffd85f" stroke="#f2b728" stroke-width="10"/>
    <g stroke="#f2b728" stroke-width="8"><path d="M210 235V205"/><path d="M210 475V505"/><path d="M105 340H75"/><path d="M345 340H375"/><path d="M135 265L112 242"/><path d="M285 415L308 438"/></g>
    <text x="210" y="348" class="ink h" font-size="19" text-anchor="middle">SUNLIGHT</text>
    <path d="M280 340 C350 340 380 300 430 290" stroke="#e1a61d" stroke-width="5" fill="none"/>
    <polygon points="430,290 414,280 416,301" fill="#e1a61d"/>
    <text x="440" y="290" fill="#8c6919" font-size="16" class="b">energy in</text>

    <path d="M160 600 C110 560 120 470 220 465 C330 460 390 540 330 610 C280 670 190 670 160 600 Z" fill="#bfe8c5" stroke="#4aa66b" stroke-width="6"/>
    <path d="M160 595 C230 580 275 520 330 482" stroke="#3a8d5a" stroke-width="6" fill="none"/>
    <ellipse cx="180" cy="555" rx="22" ry="11" fill="#46a86f"/><ellipse cx="210" cy="520" rx="22" ry="11" fill="#46a86f"/><ellipse cx="245" cy="495" rx="22" ry="11" fill="#46a86f"/>
    <text x="255" y="665" class="ink h" font-size="18" text-anchor="middle">LEAF + CHLOROPHYLL</text>

    <rect x="560" y="220" width="960" height="500" rx="26" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="600" y="265" class="ink h" font-size="24">INPUTS → LIGHT REACTIONS → CALVIN CYCLE → PRODUCTS</text>

    <rect x="610" y="330" width="210" height="118" rx="22" fill="#e9f7ff" stroke="#5ba9d6" stroke-width="3"/>
    <text x="715" y="365" class="ink h" font-size="18" text-anchor="middle">CO₂</text>
    <text x="715" y="395" class="s" font-size="16" text-anchor="middle">carbon dioxide</text>
    <text x="715" y="420" class="s" font-size="14" text-anchor="middle">stomata → leaf</text>

    <rect x="610" y="500" width="210" height="118" rx="22" fill="#edf9ff" stroke="#57a6c8" stroke-width="3"/>
    <text x="715" y="535" class="ink h" font-size="18" text-anchor="middle">H₂O</text>
    <text x="715" y="565" class="s" font-size="16" text-anchor="middle">water</text>
    <text x="715" y="590" class="s" font-size="14" text-anchor="middle">roots → xylem</text>

    <path d="M830 385 H920" class="line"/>
    <path d="M830 555 H920" class="line"/>

    <rect x="920" y="305" width="220" height="160" rx="22" fill="#fff7dc" stroke="#efc45d" stroke-width="3"/>
    <text x="1030" y="345" class="ink h" font-size="18" text-anchor="middle">LIGHT REACTIONS</text>
    <text x="1030" y="380" class="s" font-size="15" text-anchor="middle">ATP • NADPH</text>
    <text x="1030" y="410" class="s" font-size="15" text-anchor="middle">water split</text>
    <text x="1030" y="440" class="s" font-size="15" text-anchor="middle">O₂ released</text>

    <path d="M1140 385 H1210" class="line"/>
    <rect x="1210" y="305" width="220" height="160" rx="22" fill="#eef7e9" stroke="#6eb46c" stroke-width="3"/>
    <text x="1320" y="345" class="ink h" font-size="18" text-anchor="middle">CALVIN CYCLE</text>
    <text x="1320" y="380" class="s" font-size="15" text-anchor="middle">CO₂ + ATP + NADPH</text>
    <text x="1320" y="410" class="s" font-size="15" text-anchor="middle">carbon fixation</text>
    <text x="1320" y="440" class="s" font-size="15" text-anchor="middle">glucose forms</text>

    <rect x="920" y="500" width="510" height="120" rx="22" fill="#f7eefb" stroke="#b789c9" stroke-width="3"/>
    <text x="1175" y="540" class="ink h" font-size="18" text-anchor="middle">PRODUCTS</text>
    <text x="1175" y="574" class="s" font-size="16" text-anchor="middle">GLUCOSE = stored chemical energy</text>
    <text x="1175" y="600" class="s" font-size="16" text-anchor="middle">OXYGEN = released to atmosphere</text>

    <text x="1010" y="678" class="s" font-size="15">Overall: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂</text>
  </g>`;
  return shell('Photosynthesis: how light becomes chemical energy', 'Inputs, light reactions, Calvin cycle, and products', body);
}

function respirationVisual() {
  const body = `
  <g transform="translate(0,18)">
    <rect x="90" y="210" width="560" height="520" rx="26" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="120" y="255" class="ink h" font-size="23">RESPIRATORY SYSTEM</text>
    <path d="M260 285 C260 250 340 250 340 285 L340 360" class="line"/>
    <path d="M340 360 C300 405 255 450 230 505" stroke="#5d8fcb" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M340 360 C380 405 425 450 450 505" stroke="#5d8fcb" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M240 470 C170 430 125 520 195 600 C235 645 300 620 320 565 C340 620 405 645 445 600 C515 520 470 430 400 470" fill="#ffdbe5" stroke="#d86884" stroke-width="6"/>
    <text x="340" y="690" class="s" font-size="16" text-anchor="middle">lungs • bronchi • gas exchange</text>
    <path d="M120 340 H220" class="line"/><text x="120" y="320" class="s" font-size="16">air in</text>
    <path d="M460 560 H600" class="line"/><text x="480" y="540" class="s" font-size="16">O₂ into blood</text>

    <rect x="700" y="210" width="800" height="520" rx="26" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="740" y="255" class="ink h" font-size="23">ALVEOLUS • DIFFUSION • AEROBIC RESPIRATION</text>
    <circle cx="1010" cy="470" r="140" fill="#fef1f5" stroke="#e48aa2" stroke-width="10"/>
    <circle cx="1010" cy="470" r="82" fill="#fff" stroke="#8fb6de" stroke-width="9"/>
    <text x="1010" y="462" class="ink h" font-size="20" text-anchor="middle">ALVEOLUS</text>
    <text x="1010" y="490" class="s" font-size="15" text-anchor="middle">thin wall</text>
    <path d="M1145 390 C1250 330 1350 360 1420 430" stroke="#cf4c68" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M1145 540 C1250 600 1350 570 1420 500" stroke="#4d84c9" stroke-width="14" fill="none" stroke-linecap="round"/>
    <text x="1280" y="340" class="s" font-size="16">deoxygenated blood</text>
    <text x="1280" y="630" class="s" font-size="16">oxygenated blood</text>
    <path d="M900 425 H820" class="line"/><text x="760" y="420" class="s" font-size="16">O₂ diffuses in</text>
    <path d="M900 515 H820" class="line"/><text x="746" y="555" class="s" font-size="16">CO₂ diffuses out</text>
    <rect x="760" y="670" width="620" height="42" rx="21" fill="#eef6ff"/>
    <text x="1070" y="697" class="s" font-size="15" text-anchor="middle">Glucose + O₂ → CO₂ + H₂O + energy (ATP)</text>
  </g>`;
  return shell('Respiration and gas exchange', 'Air reaches alveoli, gases diffuse, cells release energy', body);
}

function cellVisual() {
  const body = `
  <g transform="translate(0,15)">
    <rect x="70" y="190" width="800" height="570" rx="28" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <ellipse cx="470" cy="470" rx="300" ry="210" fill="#eef9e7" stroke="#63a55a" stroke-width="10"/>
    <ellipse cx="470" cy="470" rx="110" ry="80" fill="#dcd8ff" stroke="#796de8" stroke-width="8"/>
    <circle cx="470" cy="470" r="32" fill="#897df0"/>
    <text x="470" y="477" class="ink h" font-size="18" text-anchor="middle">NUCLEUS</text>
    <ellipse cx="275" cy="370" rx="55" ry="22" fill="#9ed28d" stroke="#4b9940" stroke-width="6"/>
    <ellipse cx="650" cy="360" rx="55" ry="22" fill="#9ed28d" stroke="#4b9940" stroke-width="6"/>
    <ellipse cx="300" cy="560" rx="55" ry="22" fill="#9ed28d" stroke="#4b9940" stroke-width="6"/>
    <path d="M180 450 C220 420 230 410 260 400" stroke="#f6a84d" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M680 500 C720 490 740 460 770 450" stroke="#f6a84d" stroke-width="14" fill="none" stroke-linecap="round"/>
    <text x="190" y="300" class="ink h" font-size="18">CELL MEMBRANE</text>
    <text x="700" y="650" class="ink h" font-size="18">CHLOROPLASTS</text>
    <text x="110" y="720" class="s" font-size="16">Cell wall • membrane • cytoplasm • nucleus • chloroplasts • vacuole</text>

    <rect x="920" y="190" width="580" height="570" rx="28" fill="#fff" stroke="#c9d8ea" stroke-width="2" filter="url(#shadow)"/>
    <text x="960" y="235" class="ink h" font-size="23">KEY FUNCTIONS</text>
    <g font-size="17">
      <circle cx="980" cy="295" r="15" fill="#8a7bed"/><text x="1010" y="301" class="ink b">Nucleus</text><text x="1120" y="301" class="s">controls cell activities</text>
      <circle cx="980" cy="365" r="15" fill="#4d9a44"/><text x="1010" y="371" class="ink b">Chloroplast</text><text x="1125" y="371" class="s">photosynthesis</text>
      <circle cx="980" cy="435" r="15" fill="#ef9d44"/><text x="1010" y="441" class="ink b">Vacuole</text><text x="1090" y="441" class="s">storage / turgor</text>
      <circle cx="980" cy="505" r="15" fill="#6fa9d9"/><text x="1010" y="511" class="ink b">Membrane</text><text x="1115" y="511" class="s">controls movement</text>
      <circle cx="980" cy="575" r="15" fill="#6aa66a"/><text x="1010" y="581" class="ink b">Cell wall</text><text x="1100" y="581" class="s">support and shape</text>
    </g>
  </g>`;
  return shell('Plant cell: structure and function', 'A labeled cell visual with the main organelles and their jobs', body);
}

function genericVisual(topic) {
  const labels = topic.toLowerCase().includes('force') ? ['Force', 'Motion', 'Acceleration', 'Effect']
    : topic.toLowerCase().includes('chemical') ? ['Reactants', 'Bonds', 'Reaction', 'Products']
    : topic.toLowerCase().includes('math') || topic.toLowerCase().includes('equation') ? ['Given', 'Rule / Formula', 'Work', 'Answer']
    : ['Key input', 'Main structure', 'Process', 'Outcome'];
  const colors = ['#5a8fdc','#7b69d7','#58a66b','#e29c47'];
  const x0 = 95, gap = 35, w = 320, y = 330;
  const nodes = labels.map((label,i)=>{
    const x = x0 + i*(w+gap);
    return `<g><rect x="${x}" y="${y}" width="${w}" height="240" rx="28" fill="#fff" stroke="${colors[i]}" stroke-width="4" filter="url(#shadow)"/><circle cx="${x+w/2}" cy="${y+70}" r="38" fill="${colors[i]}" opacity="0.16"/><text x="${x+w/2}" y="${y+78}" text-anchor="middle" font-size="28" font-weight="800" fill="${colors[i]}">${i+1}</text><text x="${x+w/2}" y="${y+135}" text-anchor="middle" font-size="21" font-weight="800" fill="#10233f">${escapeXml(label)}</text><text x="${x+w/2}" y="${y+170}" text-anchor="middle" font-size="15" fill="#657891">topic-focused visual step</text></g>`;
  }).join('');
  const arrows = labels.slice(0,-1).map((_,i)=>{
    const x1=x0+w+i*(w+gap), x2=x1+gap;
    return `<path d="M${x1} ${y+120} H${x2}" stroke="#17345f" stroke-width="4"/><path d="M${x2} ${y+120} l-15 -10 M${x2} ${y+120} l-15 10" stroke="#17345f" stroke-width="4" fill="none"/>`;
  }).join('');
  const topicSafe = escapeXml(topic || 'Study process');
  const body = `<text x="800" y="250" class="ink h" font-size="22" text-anchor="middle">${topicSafe}</text><g>${nodes}${arrows}</g>`;
  return shell('Study diagram', 'Topic-focused structure with keywords and relationships', body);
}

function generateLocalStudyVisual(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (/heart|blood circulation|vena cava|right atrium|left ventricle|pulmonary artery|aorta/.test(p)) return heartVisual();
  if (/photosynthesis|chlorophyll|calvin cycle|carbon dioxide.*glucose/.test(p)) return photosynthesisVisual();
  if (/respiration|alveol|gas exchange|oxygen.*carbon dioxide.*lung|lungs/.test(p)) return respirationVisual();
  if (/plant cell|cell wall|chloroplast|nucleus.*vacuole/.test(p)) return cellVisual();
  return genericVisual(cleanTopic(prompt));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  const body = parseBody(req);
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ ok: false, message: 'No visual request was provided.' });
  const svg = generateLocalStudyVisual(prompt);
  return res.status(200).json({
    ok: true,
    fallback: true,
    svg,
    source: 'nimbus-local-svg',
    modelLabel: 'Nimbus 3.1 Lor Image'
  });
}
