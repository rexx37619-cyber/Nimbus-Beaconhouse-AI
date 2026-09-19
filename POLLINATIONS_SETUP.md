# Optional Pollinations visual fallback

Nimbus can use Pollinations as a server-side image fallback when `POLLINATIONS_API_KEY` is configured in Vercel.

Add this Vercel Production environment variable:

`POLLINATIONS_API_KEY=<your server-side Pollinations secret key>`

The secret stays server-side in `api/visual.js` and is never exposed to the browser.

The visual route tries Pollinations first with the `nanobanana-2` image model, then the existing Gemini Nano Banana 2 route. Pollinations currently documents the `gen.pollinations.ai/image/{prompt}` endpoint and Bearer-key authentication. Keep secret (`sk_`) keys in server-side environment variables only.
