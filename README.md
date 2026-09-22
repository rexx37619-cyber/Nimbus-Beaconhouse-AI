FINAL NIMBUS MERGED PATCH

This patch replaces api/chat.js with the known-good chat_fast_fixed.js behavior: concise keywords/facts, active-chat memory, Grade 7 science File Search, automatic science visual metadata, and a curated Beaconhouse public snapshot.

It also replaces api/visual.js with Cloudflare FLUX.1 schnell as the primary server-side image generator and Gemini 3.1 Flash Image as an optional fallback. It no longer silently returns the same generic SVG when image generation fails.

Production environment variables:
- GEMINI_API_KEY
- NIMBUS_SCIENCE_STORE
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

Do not commit real secrets or local secret files to GitHub.
