/* Nimbus V34.4: targeted, student-led scaffolds. No generated full submissions. */
const txt=v=>String(v??'').replace(/\s+/g,' ').trim();
const lc=v=>txt(v).toLowerCase();
const isGreeting=/^(hi|hello|hey|thanks|thank you|bye|good morning)[!?.\s]*$/i;
const subjects=[
 ['English',/\b(story|fiction|narrative|plot|characters?|dystopia|dystopian|genre|poem|poetry|essay|article|writing|grammar|report writing|report of|report on|letter|speech|diary|literature|paragraph|composition|creative|draft|improv(?:e|ing) my writing|enhanc(?:e|ing) my writing|safari park trip)\b/i],
 ['History',/\b(history|historical|abbasid|umayyad|caliphate|medieval|renaissance|richard the lionheart|richard i|plantagenet|crusade|mughal|dynasty|monarch|colonial|revolution|world war|treaty|empire|independence movement|administrative system)\b/i],
 ['Geography',/\b(geography|geographical|maps?\b|contour|elevation|landforms?|topograph|erosion|weathering|latitude|longitude|tectonic|volcano|earthquake|population density|migration|river|delta|watershed|relief|climate|urbanization|monsoon)\b/i],
 ['Science',/\b(science|biology|chemistry|physics|diffusion|osmosis|photosynthesis|sunlight|plants?|chlorophyll|blood|red blood cells?|white blood cells?|bones?|skeleton|joints?|cells?|organs?|tissue|respiration|lung|electric|gravity|forces?|atoms?|molecules?|metals?|nutrition|digest|enzyme|ecosystem|pollution|evaporation|condensation|magnetism|density|pressure|energy)\b/i],
 ['Mathematics',/\b(math|maths|mathematics|algebra|equation|percent(?:age)?|fraction|divide|multiply|triangle|angle|geometry|ratio|probability|integer|decimal|quadratic|calculate|solve for x)\b|\d+\s*%/i]
];
function detect(s){for(const [name,re] of subjects)if(re.test(s))return name;return '';}
const packs=[
 {name:'blood cells',subject:'Science',match:/\b(blood|red blood|white blood|erythrocytes?|leukocytes?)\b/i,
 keys:'erythrocytes, leukocytes, haemoglobin, oxygen transport, immune response, bloodstream, plasma, capillaries, cell shape, nucleus, bone marrow, infection, pathogen, antibodies, circulatory system',
 steps:['Identify both blood-cell types','Compare their structures and functions','End with why each matters'],fact:'Blood is classified as a connective tissue.',hint:'the comparison keywords “cell shape”, “haemoglobin” and “immune response”'},
 {name:'bones',subject:'Science',match:/\b(bones?|skeleton|skeletal)\b/i,
 keys:'skeleton, axial skeleton, appendicular skeleton, joints, cartilage, marrow, ligaments, vertebrae, osteocytes, collagen, calcium, minerals, bone growth, movement, support',
 steps:['Identify the age or skeleton type asked about','Organize the relevant groups','Finish with a structural detail'],fact:'Bones contain living cells, blood vessels and nerves.',hint:'the structural keywords “axial skeleton”, “appendicular skeleton” and “marrow”'},
 {name:'diffusion',subject:'Science',match:/\b(diffusion|osmosis)\b/i,
 keys:'particle model, random motion, concentration gradient, high concentration, low concentration, equilibrium, spreading, kinetic energy, temperature, gas, liquid, dissolved particles, membrane, movement, molecular scale',
 steps:['Introduce the particle-level idea','Describe the direction of change','End with an everyday example'],fact:'Temperature can affect how rapidly particles move.',hint:'the particle keywords “gradient”, “random motion” and “equilibrium”'},
 {name:'photosynthesis',subject:'Science',match:/\b(photosynthesis|chlorophyll|sunlight|green plants?)\b/i,
 keys:'chloroplast, chlorophyll, light energy, glucose, carbon dioxide, water, oxygen, stomata, leaves, producers, chemical energy, plant cells, green pigment, food production, sunlight',
 steps:['Name the process being asked about','Connect its inputs and conditions','End with its importance to plants'],fact:'Chlorophyll is a light-absorbing pigment.',hint:'the keywords “chloroplast”, “light energy” and “glucose”'},
 {name:'contour maps',subject:'Geography',match:/\b(contour|maps?|topograph|relief|elevation)\b/i,
 keys:'map scale, legend, contour interval, elevation, landforms, topography, relief, slope gradient, index contour, ridge, valley, spot height, grid reference, direction, map symbols',
 steps:['Identify the map feature','Describe what its pattern indicates','End with a practical map-reading use'],fact:'Different map types use different symbol conventions.',hint:'the map keywords “contour interval”, “elevation” and “slope gradient”'},
 {name:'erosion',subject:'Geography',match:/\b(erosion|weathering|river|delta)\b/i,
 keys:'erosion, weathering, deposition, river channel, sediment, meander, floodplain, river mouth, current, valley, transportation, gradient, tributary, water cycle, landform',
 steps:['Identify the geographical process','Link it to changing landforms','End with a named example or sketch'],fact:'Water can carry sediment between different locations.',hint:'the terms “sediment”, “deposition” and “river channel”'},
 {name:'Richard I',subject:'History',match:/\b(richard(?: the lionheart| i)?|plantagenet|third crusade)\b/i,
 keys:'Richard I, Plantagenet, medieval England, monarchy, succession, reign, Third Crusade, medieval Europe, military campaigns, regency, diplomacy, chronicles, timeline, royal records, historical sources',
 steps:['Place the person in time and location','Select events relevant to the question','End with their historical significance'],fact:'Medieval chronicles offer useful but sometimes biased accounts.',hint:'the keywords “timeline”, “Third Crusade” and “royal records”'},
 {name:'Umayyads and Abbasids',subject:'History',match:/\b(abbasid\w*|umayyad\w*|caliphate)\b/i,
 keys:'Umayyad dynasty, Abbasid dynasty, caliphate, administration, governors, provinces, bureaucracy, taxation, succession, Baghdad, Damascus, trade, cultural exchange, public works, historical chronology',
 steps:['Identify the periods and governments','Compare relevant administrative roles','End with an evidence-based difference'],fact:'Historians compare sources from different eras and viewpoints.',hint:'the keywords “governors”, “bureaucracy” and “provinces”'},
 {name:'French Revolution',subject:'History',match:/\b(french revolution|revolution|renaissance)\b/i,
 keys:'chronology, causes, social structure, political change, primary source, pamphlet, taxation, government, reform, public opinion, evidence, monarchy, revolutionary movement, consequences, perspective',
 steps:['Identify the period and central issue','Choose two evidence-based developments','End with a consequence to investigate'],fact:'Documents produced during an event can reflect conflicting perspectives.',hint:'the keywords “chronology”, “primary source” and “consequences”'},
 {name:'percentages',subject:'Mathematics',match:/\b(percent|percentage|fraction|ratio)\b|\d+\s*%/i,
 keys:'percent, hundredths, fraction, ratio, proportion, whole, part, decimal, multiplication, division, estimation, inverse operation, benchmark, units, checking',
 steps:['Identify the whole and percentage','Choose a proportion method','Check whether the result is reasonable'],fact:'A percentage expresses a relationship relative to one hundred.',hint:'the keywords “whole”, “proportion” and “estimate”'},
 {name:'algebra',subject:'Mathematics',match:/\b(algebra|equation|solve for x|linear)\b/i,
 keys:'unknown, variable, expression, coefficient, constant, equation, equality, balance, inverse operation, substitution, simplification, terms, checking, solution set, arithmetic',
 steps:['Identify the unknown and given values','Choose inverse operations','Substitute back to verify'],fact:'Both sides of an equation represent equal quantities.',hint:'the keywords “balance”, “inverse operation” and “substitution”'}
];
const fallback={
 Science:{keys:'classification, structure, function, evidence, cause, effect, process, properties, conditions, comparison, living systems, environment, mechanism, pattern, change',fact:'Scientists use testable evidence to refine explanations.',steps:['Identify what the question asks','Connect a relevant mechanism or comparison','End with one real-world link']},
 History:{keys:'chronology, historical context, source, evidence, perspective, cause, consequence, timeline, administration, society, power, significance, comparison, period, interpretation',fact:'Different primary sources may disagree about the same event.',steps:['Place the event in time','Select relevant causes or evidence','End with its significance']},
 Geography:{keys:'location, region, pattern, distribution, scale, relief, environment, process, human impact, physical feature, comparison, change, map key, data, evidence',fact:'Map scale controls how much ground detail can be shown.',steps:['Locate or identify the feature','Describe its spatial pattern','End with a relevant effect or example']},
 Mathematics:{keys:'given, unknown, relationship, method, representation, expression, calculation, units, property, sequence, transformation, estimation, verification, logic, check',fact:'Estimating first can help identify calculation mistakes.',steps:['Identify the givens','Choose a mathematical method','Check the result']}
};
function historySubject(body){const messages=Array.isArray(body?.history)?body.history:Array.isArray(body?.messages)?body.messages:[];for(const item of messages.slice(-12).reverse()){if(!['user','human'].includes(lc(item?.role??item?.sender??item?.type)))continue;const topic=detect(item?.content??item?.text??item?.message);if(topic)return topic;}return '';}
function isAcademic(s,subject,body){if(body?.forceEducation)return true;if(!subject)return false;return /\b(what|who|why|where|which|how|explain|describe|define|write|draft|help|summari|compare|differentiate|discuss|identify|report|solve|answer|structure|make|craft|enhance|improve|continue|finish|correct)\b/i.test(s)||s.length<110;}
function englishGuide(s,body){
 const genre=/\b(report|safari|trip)\b/i.test(s)?'report':/\b(poem|poetry)\b/i.test(s)?'poetry':/\b(letter)\b/i.test(s)?'letter':/\b(speech)\b/i.test(s)?'speech':/\b(article|newspaper)\b/i.test(s)?'article':/\b(essay)\b/i.test(s)?'essay':'story';
 const style=/\b(dystopian|dystopia)\b/i.test(s)?'dystopian':/\b(mystery|thriller)\b/i.test(s)?'mystery':/\b(fantasy)\b/i.test(s)?'fantasy':'original';
 const title=txt((s.match(/(?:title\s*[:=]|called|titled)\s*["']?([^,.;\n"']{3,75})/i)||[])[1]||'');
 const requestRevision=/\b(improv|enhanc|feedback|review|correct|better|revise|polish)\w*/i.test(s);
 const hasDraft=s.length>155||!!txt(body?.draft);
 const lead=genre==='report'?'Record first-hand observations in chronological order; separate facts from impressions.':genre==='poetry'?'Choose a consistent rhythm or deliberate line breaks that support your central image.':genre==='article'?'Open with the most newsworthy detail; distinguish claims from verified facts.':genre==='letter'?'Match greeting, tone and closing to the reader and purpose.':genre==='essay'?'State one argument, organize supporting points, and close by revisiting the claim.':`Plan the protagonist’s goal, obstacle and consequence${style==='dystopian'?' within a believable controlled society':''}.`;
 const vocab=genre==='report'?'observed, habitat, expedition, surroundings, distinctive, behaviour, striking, cautiously, meanwhile, consequently, accurate nouns, past tense, paragraph order, sensory detail, formal tone':genre==='story'?'foreshadowing, suspense, conflict, motive, consequence, imagery, vivid verbs, dialogue, pacing, tension, turning point, resolution, sensory detail, sentence variety, precise adjectives, character voice':'cohesion, transition, emphasis, contrast, purpose, clarity, tone, perspective, specific vocabulary, active voice, precise verbs, topic sentence, punctuation, sequence, revision';
 const extra=requestRevision?(hasDraft?'Review your own draft: strengthen one weak transition, remove repetitive wording, and check whether the ending fulfills the purpose.':'Paste your own paragraph or describe its ending so I can suggest precise improvements without replacing your writing.'):
 (genre==='story'?'Give the main character one difficult choice; make its consequence shape an ending the reader remembers.':genre==='report'?'Include one precise observation from the trip and explain why it was memorable.':'Make the closing idea meaningful by linking it to your opening purpose.');
 return ['Writing Tip: '+lead+(title?' Keep the title “'+title+'” central.':''),'','Key Vocabulary & Grammar: '+vocab,'','Enhancement: '+extra].join('\n');
}
function makeGuide(subject,s){const p=packs.find(p=>p.subject===subject&&p.match.test(s))||fallback[subject];if(!p)return null;
 const words=p.keys.split(',').map(v=>v.trim());
 // Keyword sequence is authored from the topic pack, not extracted from the student's question.
 const clue=p.hint||('the related keywords “'+words.slice(0,3).join('”, “')+'”');
 return ['Keywords: '+words.slice(0,15).join(', '),'','Answer Structure: 1) '+p.steps[0]+'. 2) '+p.steps[1]+'. 3) '+p.steps[2]+'.','','Example Answer: Craft your own answer using '+clue+'. Add one relevant example in your own words.','','Key Fact: '+p.fact].join('\n');
}
export function guidedEducation(message,body={}){
 const s=txt(message),low=lc(s);if(!s||isGreeting.test(s))return null;
 const task=lc(body?.task_mode).replace(/-/g,'_');if(['quiz','study_plan','study_file'].includes(task))return null;
 let subject=detect(s);
 const followUp=/\b(it|that|these|those|them|my answer|my writing|this answer|my draft|continue|improve|enhance|next paragraph|the ending|more about|add more)\b/i.test(s);
 if(!subject&&followUp)subject=historySubject(body);
 if(!subject&&/\b(my (?:answer|draft|writing)|writing feedback|enhance my)\b/i.test(s))subject='English';
 if(!isAcademic(s,subject,body))return null;
 return {subject,reply:subject==='English'?englishGuide(s,body):makeGuide(subject,s)};
}
