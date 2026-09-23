Nimbus final chat + visual fix.

This patch replaces api/chat.js with a resilient Gemini 3.5 Flash-Lite -> Gemini 3.5 Flash chain, retries source-grounded science questions without File Search if the store tool fails, preserves active-chat history, and adds curated Beaconhouse references.

It replaces api/visual.js so Cloudflare FLUX.1 schnell is attempted first, Gemini 3.1 Flash Image is a JPEG fallback, and the old repeated generic SVG is never returned.

Before production deployment make sure the four Vercel production environment variables in Vercel_FINAL_SETUP.txt exist. Never commit API keys or Cloudflare tokens.
