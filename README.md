# Nimbus — Netlify final

This is the Netlify-ready version of Nimbus.

## Why the previous live buttons did not work
The old site expected FastAPI endpoints (`/api/chat`, `/api/auth`) while the
site was being hosted as static content on Netlify. This version uses
Netlify Functions instead:

- `/.netlify/functions/chat`
- `/.netlify/functions/auth`
- `/.netlify/functions/admin-authorize`

Netlify currently documents `netlify/functions/` as the Functions directory,
supports environment variables for Functions, and lists Functions and Netlify
Blobs on its current Free plan.

## Netlify settings
Publish directory:
`.`
Functions directory:
`netlify/functions`

These are already in `netlify.toml`.

## Environment variables
Set in Netlify Project configuration → Environment variables:

GEMINI_API_KEY = your new Gemini API key
OWNER_EMAILS = your-email@example.com,friend@example.com
NIMBUS_DAILY_LIMIT = 1500

Optional:
GEMINI_MODEL = gemini-2.5-flash
MONTHLY_REVENUE = 0
MESSAGES_TODAY = 0

Never place the Gemini key in frontend JavaScript or the GitHub repository.

## Attachments
The Functions version accepts PDF, PNG, JPG, WEBP and TXT attachments up to
about 4 MB from the browser.

## Existing Python agent
`backend/agent.py` is retained as your source/reference implementation.
Netlify uses `netlify/functions/chat.mjs` for the live serverless chat route.

## Publishing
Push this folder to GitHub. Your connected Netlify site should redeploy
automatically. If it does not, use Deploys → Trigger deploy → Deploy site.


## Nimbus 4.5 ROR update

- Model dropdown: Nimbus 4.5 ROR (Gemini 3.5 Flash-Lite) and Nimbus 0.24.
- Daily 1,500 RPD usage indicator.
- Desktop sidebar hide/show control.
- Info panel with Nimbus and Beaconhouse branding.
- Official Beaconhouse resource links.
- Login accepts only `@bh.edu.pk` or `@beaconite.edu.pk` identifiers.

The security/cybersecurity staff name is intentionally not hard-coded for a public site.
If you have the person's consent to publish their name and role, configure it as public
content only after confirming that permission.


## Rapid-clean Nimbus 4.5 ROR update

This build intentionally keeps the UI quiet and fast: no typing animation, no decorative agent animation, no animated agent badge, and no underlying Google model name displayed in the UI.

The public ROR path uses Gemini 3.5 Flash-Lite with minimal thinking for low latency, with a lightweight fallback to Gemini 2.5 Flash-Lite. Google's current API documentation lists Gemini 3.5 Flash-Lite as supporting minimal, low, medium and high thinking levels, with minimal optimized for speed.

The `knowledge/` directory contains public Beaconhouse reference notes and official links for BISC, RISE competitions, LAP, BEAMS, PRISM, book-pack archives, sports/STEAM competitions, trips, internships and related programmes. These are reference snapshots; current campus/class-specific details should be verified against the linked official source.

The public chat does not reveal the technical underlying Gemini model name.


## Latest requested behavior
- Nimbus logo is shown inside the model selector.
- A small side AI agent appears only while Nimbus is processing.
- The side agent shows three animated dots; there is no response typing animation.
- Code responses are formatted into decorated blocks with language labels.
- The UI hides underlying Google model IDs.
- The rapid path uses minimal thinking and a fallback.
- Public 2026–2027 Beaconhouse book-list portals are linked by region, with
  Class 1–8 selectors.
- Do not treat old book-pack documents as current universal lists.
