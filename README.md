# Nimbus chat-response fix

This is a targeted backend patch only.

It fixes:
- "hi" / normal chat being formatted as schoolwork
- Beaconhouse questions being forced into academic labels
- removal of Key function(s) unless the student explicitly asks for a function/role/purpose
- placeholder response skeletons such as "topic-based study points", "retry the same question", and "short structured response unavailable"
- deterministic classification between normal conversation and educational questions

It does NOT modify api/visual.js or the image-generation pipeline.
It also restores knowledge/grade7_science_setup.txt.

Apply by copying these files into Nimbus_CLEAN, then run:

npm install
node --check .\api\chat.js
git add .
git commit -m "Fix Nimbus academic response formatting"
git push origin main

Then wait for Vercel Ready and hard refresh the site.
