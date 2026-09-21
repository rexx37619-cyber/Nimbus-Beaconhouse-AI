import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
const files = process.argv.slice(2).filter(Boolean);

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set in this PowerShell session. Set it locally; do not put the key in GitHub or the website.');
  process.exit(1);
}
if (!files.length) {
  console.error('Usage: node .\\scripts\\create-grade7-science-store.mjs "C:\\path\\BookPart1.pdf" "C:\\path\\BookPart2.pdf"');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const store = await ai.fileSearchStores.create({
  config: {
    displayName: 'Nimbus Grade 7 Science Source',
    embeddingModel: 'models/gemini-embedding-2'
  }
});

console.log(`Created File Search store: ${store.name}`);

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`Indexing ${path.basename(file)} ...`);
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    file,
    fileSearchStoreName: store.name,
    config: {
      displayName: path.basename(file)
    }
  });
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.get({ operation });
  }
  console.log(`Indexed: ${path.basename(file)}`);
}

fs.mkdirSync('knowledge', { recursive: true });
fs.writeFileSync('knowledge/nimbus_science_store.txt', `${store.name}\n`, 'utf8');
console.log('');
console.log('STORE NAME TO ADD TO VERCEL:');
console.log(store.name);
console.log('Saved locally to knowledge/nimbus_science_store.txt');
