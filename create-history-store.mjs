import fs from 'node:fs/promises';
import path from 'node:path';

const key = String(process.env.GEMINI_API_KEY || '').trim();

if (!key) {
  throw new Error('GEMINI_API_KEY is missing.');
}

const files = [
  process.argv[2],
  process.argv[3]
].filter(Boolean);

if (files.length !== 2) {
  throw new Error('Provide two PDF paths.');
}

async function createStore() {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/fileSearchStores',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        displayName: 'Nimbus Grade 7 History',
        embeddingModel: 'models/gemini-embedding-2'
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Store creation failed: HTTP ${response.status}`
    );
  }

  return data.name;
}

async function uploadToStore(storeName, filePath) {
  const bytes = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/${storeName}:uploadToFileSearchStore`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        displayName: fileName
      })
    }
  );

  if (!startResponse.ok) {
    const text = await startResponse.text();
    throw new Error(`Upload start failed: HTTP ${startResponse.status} ${text}`);
  }

  const uploadUrl =
    startResponse.headers.get('x-goog-upload-url') ||
    startResponse.headers.get('X-Goog-Upload-URL');

  if (!uploadUrl) {
    throw new Error('Google did not return an upload URL.');
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: bytes
  });

  const data = await uploadResponse.json();

  if (!uploadResponse.ok) {
    throw new Error(
      data?.error?.message ||
      `File upload failed: HTTP ${uploadResponse.status}`
    );
  }

  return data;
}

async function waitForOperation(operationName) {
  if (!operationName) return;

  for (;;) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${encodeURIComponent(key)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `Operation check failed: HTTP ${response.status}`
      );
    }

    if (data.done) {
      if (data.error) {
        throw new Error(data.error.message || 'File indexing failed.');
      }
      return;
    }

    console.log('Indexing...');
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}

const store = await createStore();

console.log(`HISTORY_STORE=${store}`);

for (const filePath of files) {
  console.log(`Uploading ${path.basename(filePath)}...`);
  const result = await uploadToStore(store, filePath);
  const operationName = result?.name || result?.operation?.name;
  await waitForOperation(operationName);
  console.log(`Indexed ${path.basename(filePath)}.`);
}

console.log(`DONE_HISTORY_STORE=${store}`);
