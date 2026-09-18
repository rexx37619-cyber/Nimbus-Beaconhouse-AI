# Cloudflare Pages quick setup for Nimbus

1. Open Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Select `rexx37619-cyber/Nimbus-Beaconhouse-AI`.
3. Use the existing `main` branch.
4. Build command: leave empty.
5. Output directory: `.`
6. Deploy.
7. In Settings → Environment variables, add:
   - `GEMINI_API_KEY`
   - `OWNER_EMAILS` = `haadi6228@gmail.com,jollyzmotion@gmail.com`
   - `GITHUB_OWNER` = `rexx37619-cyber`
   - `GITHUB_REPO` = `Nimbus-Beaconhouse-AI`
   - `GITHUB_BRANCH` = `main`
   - `NIMBUS_DAILY_LIMIT` = `1500`
8. Trigger a new deployment after adding variables.

No `GITHUB_TOKEN` is used by this build.
