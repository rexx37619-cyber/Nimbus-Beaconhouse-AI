# Nimbus Grade 7 Science + Visual Upgrade

This upgrade keeps the textbook PDFs out of the Git repository. The two user-supplied PDF parts are indexed into Gemini File Search, then Nimbus retrieves only the relevant chunks at question time. This is preferable to pasting the complete book into JavaScript.

## What this adds

- Grade 7 science RAG using Gemini File Search.
- Simple Beaconhouse Grade 7 answer style: Keywords, Key function(s), Key fact(s), Answer structure.
- Paraphrased explanations rather than copied textbook passages.
- File-source citations when Gemini returns them.
- Higher-quality science diagrams through Gemini 3.1 Flash Image (Nano Banana 2) at 16:9 / 2K.
- A stronger science-specific fallback SVG if image generation is temporarily unavailable.
- More official Beaconhouse links, including current book-list portals and Class 7 Sindh & Balochistan.

## Step 1: install the server SDK

From the Nimbus project folder:

```powershell
cd "C:\Users\Hassan Rauf\Downloads\Nimbus_CLEAN"
npm install
```

## Step 2: create the science File Search store

Keep the Gemini key only in your local PowerShell session. Never commit it.

```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

Then point the setup script at the two PDF files you uploaded. Example:

```powershell
node ".\scripts\create-grade7-science-store.mjs" "C:\path\Book 21 Sept 2026.pdf" "C:\path\2739c64a-4ddb-44ac-9eae-8d0042e0a43b (1).pdf"
```

The script creates a persistent File Search store, waits for both PDFs to finish indexing, and prints a store name such as:

```text
fileSearchStores/xxxxxxxx
```

## Step 3: put the store name in Vercel

In the Vercel project for Nimbus, add this environment variable:

```text
NIMBUS_SCIENCE_STORE=fileSearchStores/xxxxxxxx
```

Use your real store name from Step 2. Do not put the Gemini API key into this file.

## Step 4: deploy Nimbus

From `Nimbus_CLEAN`:

```powershell
git add .
git commit -m "Add Grade 7 science RAG and upgraded visuals"
git push origin main
```

Vercel should build the updated `api/chat.js` and `api/visual.js`.

## Step 5: test science grounding

Try:

```text
What is a joint? Give keywords and key functions only. Keep it Grade 7 simple.
```

Then:

```text
What is the difference between a hinge joint and a ball-and-socket joint? Keywords only.
```

Then:

```text
Show a labelled Grade 7 diagram of the types of joints.
```

A grounded answer may include a compact source line such as `Source: Book 21 Sept 2026.pdf • p. 1` when Gemini supplies a page citation.

## Important

The uploaded PDFs are not pasted wholesale into the JavaScript bundle. File Search indexes the documents and retrieves relevant chunks when needed. This means the source remains in Google's File Search store and the website code stays small. The File Search embeddings persist until the store is deleted; raw Files API uploads have a separate retention period.
