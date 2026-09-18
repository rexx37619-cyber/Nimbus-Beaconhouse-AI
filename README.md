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
