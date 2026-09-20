# Nimbus 3.1 Lor Image — Local Visual Engine

The public Nimbus image generator no longer calls a paid image model or requires a second API key.

When the educational-question detector triggers a visual, `/api/visual` generates a 16:9 SVG study visual locally in the Vercel function and returns it to the existing `Nimbus 3.1 Lor Image` card.

Supported built-in visual templates include:
- Human heart / blood circulation
- Photosynthesis
- Respiration / alveoli / gas exchange
- Plant cell
- General academic processes and formulas

This is intentionally free and deterministic. It creates vector educational diagrams, not photorealistic AI photos. No Puter login and no Gemini image quota are used for these visuals.

The main Nimbus text AI continues to use `GEMINI_API_KEY` through `/api/chat`.
