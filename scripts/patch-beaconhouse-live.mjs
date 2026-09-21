import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../api/chat.js', import.meta.url);
let s = await readFile(path, 'utf8');

const marker = 'function looksLikeBeaconhouse(text) {';
if (!s.includes(marker)) throw new Error('Could not find current looksLikeBeaconhouse function. No changes made.');

if (!s.includes('async function fetchBeaconhouseLive')) {
  const fn = `async function fetchBeaconhouseLive(userText) {\n  const q = String(userText || '').toLowerCase();\n  const pages = [\n    ['Beaconhouse main', 'https://www.beaconhouse.net/'],\n    ['Academics', 'https://www.beaconhouse.net/academic/'],\n    ['Clubs and Societies', 'https://www.beaconhouse.net/clubs-and-societies/'],\n    ['Sports competitions', 'https://www.beaconhouse.net/sports-competition/'],\n    ['STEAM competitions', 'https://www.beaconhouse.net/steam-competition/'],\n    ['Results', 'https://www.beaconhouse.net/results/'],\n    ['BISC', 'https://bisc.beaconhouse.net/'],\n    ['RISE', 'https://rise.beaconhouse.net/'],\n    ['BEAMS', 'https://beams.beaconhouse.net/home/'],\n    ['LAP 2026', 'https://lap.beaconhouse.net/guidelines-2/'],\n    ['LAP ILAP 2027', 'https://lap.beaconhouse.net/guidelines-ilap-2027/'],\n    ['Book lists', 'https://booklist.beaconhouse.net/']\n  ];\n\n  const ranked = pages.map(([name,url]) => {\n    const hay = (name + ' ' + url).toLowerCase();\n    let score = 0;\n    for (const token of q.split(/\\W+/).filter(Boolean)) if (hay.includes(token)) score += 1;\n    if (/bisc/.test(q) && /bisc/.test(hay)) score += 8;\n    if (/beams/.test(q) && /beams/.test(hay)) score += 8;\n    if (/lap|ilap|learner agency/.test(q) && /lap/.test(hay)) score += 8;\n    if (/book.?list|books/.test(q) && /booklist/.test(hay)) score += 8;\n    if (/academic|curriculum|school/.test(q) && /academic/.test(hay)) score += 5;\n    if (/sport|competition/.test(q) && /competition|results/.test(hay)) score += 4;\n    return {name,url,score};\n  }).sort((a,b)=>b.score-a.score).slice(0,4);\n\n  const out = [];\n  for (const {name,url} of ranked) {\n    try {\n      const r = await fetch(url, { headers: { 'user-agent': 'Nimbus-Beaconhouse-AI/1.0' } });\n      if (!r.ok) continue;\n      const html = await r.text();\n      const text = html\n        .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')\n        .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')\n        .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')\n        .replace(/<[^>]+>/g, ' ')\n        .replace(/&nbsp;/gi, ' ')\n        .replace(/&amp;/gi, '&')\n        .replace(/&quot;/gi, '\"')\n        .replace(/&#39;/gi, "'")\n        .replace(/\\s+/g, ' ')\n        .trim();\n      if (text) out.push('[' + name + '] ' + text.slice(0, 5000) + '\\nURL: ' + url);\n    } catch (_) {}\n  }\n  return out.join('\\n\\n');\n}\n\n`;
  s = s.replace(marker, fn + marker);
}

const oldQuery = 'const beaconhouseQuery = looksLikeBeaconhouse(userText);';
const newQuery = 'const beaconhouseQuery = looksLikeBeaconhouse(userText);\n      const beaconhouseLive = beaconhouseQuery ? await fetchBeaconhouseLive(userText) : \"\";';
if (s.includes(oldQuery) && !s.includes(newQuery)) s = s.replace(oldQuery, newQuery);

const oldParsed = 'const parsedText = beaconhouseQuery ? `${rag.text}\\n${BEACONHOUSE_CONTEXT}` : rag.text;';
const newParsed = 'const parsedText = beaconhouseQuery ? `${rag.text}\\n${BEACONHOUSE_CONTEXT}\\n${beaconhouseLive}` : rag.text;';
if (s.includes(oldParsed)) s = s.replace(oldParsed, newParsed);

const oldSystem = 'const systemText = `${BASE_SYSTEM}\\n${beaconhouseQuery ? BEACONHOUSE_CONTEXT : \'\'}`;';
const newSystem = 'const systemText = `${BASE_SYSTEM}\\n${beaconhouseQuery ? BEACONHOUSE_CONTEXT : \'\'}\\n${beaconhouseLive || \'\'}`;';
if (s.includes(oldSystem)) s = s.replace(oldSystem, newSystem);

await writeFile(path, s, 'utf8');
console.log('Beaconhouse live-fetch patch applied successfully.');
