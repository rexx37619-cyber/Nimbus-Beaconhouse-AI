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

- Public visual generation uses the Gemini API key directly; no Puter sign-in is required for images.

## Visual generation
Nano Banana 2 uses the Gemini API key server-side. The primary model is `gemini-3.1-flash-image` through the Interactions API, with a GenerateContent fallback and a legacy `gemini-2.5-flash-image` fallback. Image generation requires a Gemini API project/key with access to the image model; it is not a Puter-login feature.

## Workspace model usage note
The private workspace intentionally exposes only GPT-6 Astra, Claude Fable 5.1, and Nano Banana 2. GPT-6 Astra/Fable 5.1 chat calls are sent through Puter only when Puter exposes a free variant (`:free` or zero-cost metadata) for the signed-in account. This avoids chargeable calls and avoids triggering the Puter low-balance prompt. If no free variant is exposed, the workspace shows a clear no-free-variant message instead of sending a paid request. Nano Banana 2 remains the visual model and uses the server-side Gemini API route.

Puter's current User-Pays model gives each account a free monthly allowance and then prompts users to upgrade when that allowance is exhausted. The application cannot override Puter's billing/allowance system or make paid model usage unlimited for free.


## Workspace premium models
The private workspace uses Puter User-Pays and calls these exact model IDs directly: `openai/gpt-6-astra` and `anthropic/claude-fable-5-1`. The app does not block on a locally inferred 'free variant'. Developer integration is $0 under Puter's User-Pays model, while the signed-in Puter user covers model usage.
