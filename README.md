# Nimbus — Cloudflare version

Nimbus is a student-built educational AI site with a private owner workspace.

## Hosting
This version is prepared for Cloudflare Pages + Pages Functions.

Important current Cloudflare limits:
- Static asset requests on Pages Free are free and unlimited.
- Pages Functions count as Workers requests. The Workers Free plan currently allows 100,000 requests per day.
So the static site is effectively unlimited for free, but backend/API traffic is still quota-limited.

## Cloudflare environment variables
Set these in the Cloudflare Pages project under Settings → Environment variables / Variables:

GEMINI_API_KEY = your Gemini API key
OWNER_EMAILS = haadi6228@gmail.com,jollyzmotion@gmail.com
GITHUB_OWNER = rexx37619-cyber
GITHUB_REPO = Nimbus-Beaconhouse-AI
GITHUB_BRANCH = main
NIMBUS_DAILY_LIMIT = 1500

Do not add GITHUB_TOKEN. The workspace reads the public repository without a GitHub credential and the file editor exports edited files for manual `git push origin main`.

## Cloudflare structure
- Static site: repository root
- Pages Functions: `functions/api/*`
- `wrangler.toml`: Cloudflare Pages configuration
- `_routes.json`: keeps backend Functions limited to `/api/*`, so static requests stay on the unlimited static path

## API routes
- `/api/auth`
- `/api/chat`
- `/api/admin-authorize`
- `/api/workspace-authorize`
- `/api/project-files`
- `/api/project-file`

## Workspace
`/workspace.html` is private and marked `noindex,nofollow,noarchive`.
Access is owner-only and is checked with Puter sign-in plus the server-side `OWNER_EMAILS` allowlist.
The workspace includes:
- Nimbus 5.7 Lor • Ultra Modified private agent
- Puter OpenAI model dropdown
- Previous private agent chats
- Owner-only revenue/profit panel in PKR
- Curated important-repo file editor
- 16:9 Nimbus UI Layout Studio
- Live Nimbus iframe preview
- Security status panel

## Code responses
Nimbus is instructed to place requested code in fenced Markdown blocks with a language identifier. The UI also renders a language label and Copy button.

## Visual helper
Nimbus can append a `Nano Banana 2 visual plan` for genuinely useful diagrams, flowcharts, game-system visuals and keyword sheets. The plan is returned as a prompt suitable for `gemini-3.1-flash-image`.

Nano Banana 2 is a Gemini API image model. Current Google pricing lists Nano Banana 2 as a paid image-generation model; do not assume it is free for API use. This build therefore generates the visual plan automatically but does not silently spend image-generation credits. Actual image generation can be enabled as a separate deliberate feature later.

## AI style
Normal Nimbus prose avoids double-asterisk bold markers and avoids Markdown heading syntax with `#`. Code blocks are still allowed to contain `#` where the programming language requires it.

## Local publishing
The main project folder is:
`C:\Users\Hassan Rauf\Downloads\Nimbus_CLEAN`

Typical publish flow:
1. Replace edited files in `Nimbus_CLEAN`.
2. `git add .`
3. `git commit -m "Describe change"`
4. `git push origin main`

## Cloudflare Pages deployment
Connect the existing GitHub repo:
`https://github.com/rexx37619-cyber/Nimbus-Beaconhouse-AI`

Build command: none
Build output directory: `.`

The Pages project should detect the `functions/` directory automatically. Keep `_routes.json` in the deployed root so only `/api/*` invokes Functions.

## Vercel deployment
This version uses Vercel Functions in `api/*.js`. Set Framework Preset to Other, leave Build Command empty, and deploy the repository root.
