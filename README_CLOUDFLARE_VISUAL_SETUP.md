# Nimbus Stable + Cloudflare Visual

This package is based on the previously stable Nimbus build. The public chat UI, school-answer formatting, Beaconhouse knowledge files, workspace files, and `/api/visual` frontend connection are preserved.

Only the visual backend was replaced with Cloudflare Workers AI FLUX.1 schnell.

Required Vercel Production environment variables:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
- GEMINI_API_KEY
- NIMBUS_DAILY_LIMIT (if already used by Nimbus)

For the Cloudflare token, Workers AI Edit permission is sufficient for the direct inference endpoint used by this route. Do not place the token in app.js or commit it to GitHub.

The frontend already calls `/api/visual`, so no visual UI rewrite is required.
