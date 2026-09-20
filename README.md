# Nimbus 5.7 Lor — Image Interface + Puter-Only Workspace

This build is prepared for the Vercel deployment used by Nimbus.

Changes in this build:
- Puter sign-in is the only workspace gate. No server-side owner allowlist is called by the workspace UI.
- The old security-check interface is removed from the workspace navigation and gate.
- Successful Puter authentication displays ACCESS ALLOWED and opens the workspace.
- Nano Banana 2 visual generation uses the current Gemini 3.1 Flash Image Generate Content API, with a Puter image-generation fallback on the public site.
- Schoolwork/diagram/flowchart requests automatically show a dedicated visual card with a loading-dot interface and then the generated image.
- Raw [NIMBUS_VISUAL] marker text is removed from student-facing replies.
- Normal Nimbus text is cleaned to remove Markdown ** emphasis and heading # markers.
- Code remains in fenced language-labelled code blocks.

Final stabilization notes:
- Workspace Puter agent resolves live model objects and silently falls back to /api/chat if Puter returns a balance/allowance error.
- Workspace access permits only Puter usernames neat_ocean_262513 and peaceful_balloon_864250.
- Public/workspace Nano Banana visuals use Gemini server-side; Puter image generation is not used for ordinary Nimbus visuals.
- Visual endpoint uses Gemini Interactions API first, then Generate Content compatibility fallbacks, then a topic-aware SVG fallback.


Main-site automatic visual update: image generation is hidden from the model dropdown. Nimbus 3.1 Lor Image (gemini-3.1-flash-lite-image) auto-triggers only for genuine academic/educational questions. Greetings, casual chat, and Beaconhouse-specific questions do not trigger visuals. The visual API uses Google's official Interactions API, 16:9, 1K.


Final automatic visual fix: educational messages now render the Nimbus 3.1 Lor Image card and call /api/visual; greetings and Beaconhouse queries are excluded.


Image generation now uses the official @google/genai SDK with models gemini-3.1-flash-lite-image (1K) and gemini-3.1-flash-image (2K) as a compatibility fallback, matching Google's current documented generateContent flow.


Image API hotfix: the Gemini Interactions image response now explicitly requests JPEG because the current endpoint rejects image/png for response_format.mime_type.

## Visual generation

Public educational visuals are generated locally by `api/visual.js` as polished 16:9 SVG study diagrams. This avoids image-model quota failures and does not require Puter authentication. Topic-aware templates are included for heart circulation, photosynthesis, respiration/gas exchange, plant cells, and a general academic flow diagram.
