import fs from 'node:fs';
const file='api/visual.js';
let s=fs.readFileSync(file,'utf8');
if (s.includes("response_format:{type:'image',mime_type:'image/png'")) {
  s=s.replace("response_format:{type:'image',mime_type:'image/png'","response_format:{type:'image',mime_type:'image/jpeg'");
  fs.writeFileSync(file,s);
  console.log('Fixed Gemini image response format to JPEG.');
} else {
  console.log('Gemini JPEG response-format fix already present or pattern changed.');
}
