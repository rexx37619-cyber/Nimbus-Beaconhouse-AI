import fs from 'node:fs';

const file = 'api/chat.js';
if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run this from Nimbus_CLEAN.`);
let s = fs.readFileSync(file, 'utf8');

if (s.includes('async function fetchOfficialBeaconhouseContext')) {
  console.log('Beaconhouse live-fetch patch is already installed.');
  process.exit(0);
}

const extraLinks = `
  ['Events','https://www.beaconhouse.net/events/'],
  ['International events and trips','https://www.beaconhouse.net/international-events-trips/'],
  ['Education trips','https://www.beaconhouse.net/education-trips/'],
  ['Access Centre','https://www.beaconhouse.net/the-access-centre/'],
  ['University placements & scholarships','https://www.beaconhouse.net/university-placements-scholarships/'],
  ['Internship programme','https://www.beaconhouse.net/internship-programme/'],
  ['Child protection','https://www.beaconhouse.net/child-protection/'],
  ['International Baccalaureate PYP','https://www.beaconhouse.net/international-baccalaureate-programs/pyp/'],
  ['CIE A Level','https://www.beaconhouse.net/cie-a-level/']
`;

const marker = '];\nconst BEACONHOUSE_CONTEXT = `';
if (!s.includes(marker)) throw new Error('Could not find BEACONHOUSE_OFFICIAL_LINKS marker.');
if (!s.includes("['Events','https://www.beaconhouse.net/events/']")) {
  s = s.replace(marker, `${extraLinks}];\nconst BEACONHOUSE_CONTEXT = \``);
}

const contextOld = `const BEACONHOUSE_CONTEXT = \`\nBeaconhouse public-information grounding:\nWhen a question is specifically about Beaconhouse, use only the official public references listed below. Do not claim access to private school systems, BEAMS accounts, grades, attendance, student records, passwords, or internal documents. Do not invent campus-specific rules. Treat current book-list pages as regional/campus-specific public references.\n\${BEACONHOUSE_OFFICIAL_LINKS.map(([name,url]) => \`- \${name}: \${url}\`).join('\\n')}\n\`;`;
const contextNew = `const BEACONHOUSE_CONTEXT = \`\nBeaconhouse public-information grounding:\nWhen a question is specifically about Beaconhouse, use official public references only. Do not claim access to private school systems, BEAMS accounts, grades, attendance, student records, passwords, or internal documents. Do not invent campus-specific rules. Treat current book-list pages as regional/campus-specific public references. Live official-page text fetched below is the primary evidence when available; if it does not support a detail, say so instead of guessing.\n\${BEACONHOUSE_OFFICIAL_LINKS.map(([name,url]) => \`- \${name}: \${url}\`).join('\\n')}\n\`;`;
if (!s.includes(contextOld)) throw new Error('Could not find Beaconhouse context block.');
s = s.replace(contextOld, contextNew);

const insertBefore = 'function sourceNote(sources) {';
if (!s.includes(insertBefore)) throw new Error('Could not find sourceNote marker.');
const helper = `const BEACONHOUSE_FETCH_CACHE = new Map();
const BEACONHOUSE_PAGE_RULES = [
  {keys:['bisc','international student convention'], urls:['https://bisc.beaconhouse.net/','https://bisc.beaconhouse.net/about-bisc/']},
  {keys:['beams','beam'], urls:['https://beams.beaconhouse.net/home/','https://beams.beaconhouse.net/prism/']},
  {keys:['lap','learner agency','ilap','learner agency paradigm'], urls:['https://lap.beaconhouse.net/','https://lap.beaconhouse.net/about-us/','https://lap.beaconhouse.net/guidelines-2/','https://lap.beaconhouse.net/guidelines-ilap-2027/']},
  {keys:['boss'], urls:['https://boss.beaconhouse.net/about-us/']},
  {keys:['book list','booklist','books'], urls:['https://booklist.beaconhouse.net/','https://booklist.beaconhouse.net/booklist/2025/sindh-balochistan/class7/','https://booklist.beaconhouse.net/punjab-booklist/','https://booklist.beaconhouse.net/kpk-booklist/','https://booklist.beaconhouse.net/ict-booklist/']},
  {keys:['sport','sports'], urls:['https://www.beaconhouse.net/sports-competition/']},
  {keys:['steam','e-steam'], urls:['https://www.beaconhouse.net/steam-competition/']},
  {keys:['academic','curriculum','school programme'], urls:['https://www.beaconhouse.net/academic/','https://www.beaconhouse.net/academic-programs/']},
  {keys:['club','society'], urls:['https://www.beaconhouse.net/clubs-and-societies/']},
  {keys:['event','trip'], urls:['https://www.beaconhouse.net/events/','https://www.beaconhouse.net/international-events-trips/','https://www.beaconhouse.net/education-trips/']},
  {keys:['learner profile'], urls:['https://www.beaconhouse.net/beaconhouse-learner-profile/']},
  {keys:['access centre','access center'], urls:['https://www.beaconhouse.net/the-access-centre/']},
  {keys:['scholarship','university'], urls:['https://www.beaconhouse.net/university-placements-scholarships/']},
  {keys:['internship'], urls:['https://www.beaconhouse.net/internship-programme/']},
  {keys:['child protection'], urls:['https://www.beaconhouse.net/child-protection/']},
  {keys:['pyp','ib','international baccalaureate'], urls:['https://www.beaconhouse.net/international-baccalaureate-programs/pyp/']},
  {keys:['a level','a-level','cie'], urls:['https://www.beaconhouse.net/cie-a-level/']}
];
function cleanBeaconhouseHtml(html){
  return String(html||'')
    .replace(/<script[\\s\\S]*?<\\/script>/gi,' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi,' ')
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\\s+/g,' ').trim();
}
async function fetchBeaconhousePage(url){
  const cached=BEACONHOUSE_FETCH_CACHE.get(url);
  if(cached && (Date.now()-cached.time)<30*60*1000) return cached.text;
  try{
    const r=await fetch(url,{headers:{'User-Agent':'Nimbus Beaconhouse Educational AI/1.0'},signal:AbortSignal.timeout(4500)});
    if(!r.ok) return '';
    const html=await r.text();
    const text=cleanBeaconhouseHtml(html).slice(0,6500);
    if(text) BEACONHOUSE_FETCH_CACHE.set(url,{time:Date.now(),text});
    return text;
  }catch{return '';}
}
async function fetchOfficialBeaconhouseContext(query){
  const q=String(query||'').toLowerCase();
  const matched=[];
  for(const rule of BEACONHOUSE_PAGE_RULES){ if(rule.keys.some(k=>q.includes(k))) matched.push(...rule.urls); }
  if(!matched.length) matched.push('https://www.beaconhouse.net/','https://www.beaconhouse.net/academic/','https://booklist.beaconhouse.net/');
  const urls=[...new Set(matched)].slice(0,6);
  const pages=await Promise.all(urls.map(async url=>({url,text:await fetchBeaconhousePage(url)})));
  const usable=pages.filter(p=>p.text).slice(0,5);
  if(!usable.length) return '';
  return '\\nBEACONHOUSE LIVE OFFICIAL PAGE TEXT (retrieved at request time):\\n'+usable.map(p=>`[${p.url}]\\n${p.text}`).join('\\n\\n');
}
`;
s = s.replace(insertBefore, helper + '\n' + insertBefore);

s = s.replace(
  'async function requestScienceRag(apiKey, model, userText, memoryText) {',
  'async function requestScienceRag(apiKey, model, userText, memoryText, liveBeaconhouseContext) {'
);
s = s.replace(
  'system_instruction: `${BASE_SYSTEM}\\n${SCIENCE_SYSTEM}\\n${BEACONHOUSE_CONTEXT}`,',
  'system_instruction: `${BASE_SYSTEM}\\n${SCIENCE_SYSTEM}\\n${BEACONHOUSE_CONTEXT}\\n${liveBeaconhouseContext || \'\'}`, '
);
s = s.replace(
  'const beaconhouseQuery = looksLikeBeaconhouse(userText);',
  'const beaconhouseQuery = looksLikeBeaconhouse(userText);\n    const beaconhouseLiveContext = beaconhouseQuery ? await fetchOfficialBeaconhouseContext(userText) : \'\';'
);
s = s.replace(
  'const rag = await requestScienceRag(apiKey, ragModel, userText, memoryText);',
  'const rag = await requestScienceRag(apiKey, ragModel, userText, memoryText, beaconhouseLiveContext);'
);
s = s.replace(
  'const parsedText = beaconhouseQuery ? `${rag.text}\\n${BEACONHOUSE_CONTEXT}` : rag.text;',
  'const parsedText = beaconhouseQuery ? `${rag.text}\\n${BEACONHOUSE_CONTEXT}\\n${beaconhouseLiveContext}` : rag.text;'
);
s = s.replace(
  'const systemText = `${BASE_SYSTEM}\\n${beaconhouseQuery ? BEACONHOUSE_CONTEXT : \'\'}`;',
  'const systemText = `${BASE_SYSTEM}\\n${beaconhouseQuery ? `${BEACONHOUSE_CONTEXT}\\n${beaconhouseLiveContext}` : \'\'}`;'
);

fs.writeFileSync(file, s);
console.log('Installed live official Beaconhouse fetching and expanded official-link coverage.');
