// Nimbus V34.2: one shared, server-side student safety boundary.
// A deterministic screen is a first layer, not a guarantee. Preserve provider safety filtering.
const tidy = value => String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const blocked = Object.freeze({
  UNSAFE_REQUEST: 'I can help with safe, age-appropriate learning instead. Please choose another question or topic.',
  UNSAFE_VISUAL: 'I can create educational, age-appropriate visuals instead. Try a school subject, diagram, or safe illustration.',
  SUPPORT_REQUEST: 'I’m sorry you’re dealing with this. You deserve support from someone you trust. Please tell a trusted adult or counselor how you’re feeling; if you might be in immediate danger, contact local emergency services now.',
  SAFETY_BYPASS: 'Nimbus keeps its learning and safety rules active across messages. I can still help you with a hint, plan, or constructive question.'
});
// High-confidence request patterns only: never treat ordinary science, history, art or health education as misconduct.
const safetyOverride = /\b(?:ignore|disable|turn off|remove|circumvent|override|bypass|jailbreak)\b.{0,55}\b(?:safety|moderation|content filter|age restriction|age limit|restrictions|guardrails?)\b/;
const sexual = /\b(?:porn(?:ography|ographic)?|erotic|explicit sexual|sexual content|nude|nudity|naked|sexually explicit|fetish)\b/;
const childExploitation = /\b(?:sexualiz(?:e|ing|ation)|nude|naked|explicit sexual)\b.{0,75}\b(?:child|minor|kid|schoolgirl|schoolboy|underage|teen)\b|\b(?:child|minor|kid|schoolgirl|schoolboy|underage|teen)\b.{0,75}\b(?:sexualiz(?:e|ing|ation)|nude|naked|explicit sexual)\b/;
const extremeViolence = /\b(?:gore|gory|graphic violence|graphic injury|gruesome|torture|bloodbath|dismemberment)\b/;
const selfHarmIntent = /\b(?:i (?:want|plan|need) to (?:hurt|harm|kill) myself|i(?:'m| am) (?:thinking|planning) (?:about|of) (?:suicide|hurting myself)|i want to die|help me (?:harm|hurt|kill) myself)\b/;
const selfHarmHowTo = /\b(?:how (?:can|do|to)|teach me|ways to|instructions? (?:for|to)|steps? to)\b.{0,95}\b(?:self[- ]?harm|suicide|hurt myself|kill myself)\b/;
const maliciousHowTo = /\b(?:how (?:to|do i)|steps? (?:to|for)|instructions? (?:for|to)|teach me (?:to|how)|give me (?:a|the) (?:method|recipe|instructions))\b.{0,100}\b(?:make (?:an? )?(?:explosive|bomb|weapon)|steal passwords?|hack (?:someone|a person|my friend)|poison (?:someone|a person)|buy (?:illegal|restricted) drugs?|use (?:illegal|recreational) drugs?)\b/;
const dangerousItem = /\b(?:give me instructions (?:for|to)|show me how to)\b.{0,80}\b(?:weapon|explosive|drug trafficking|fentanyl|methamphetamine)\b/;
const bullying = /\b(?:write|generate|make|create|give me)\b.{0,70}\b(?:bullying|harassment|hate speech|racial slurs|threatening message|insults? (?:to|for|about) (?:my|a|the) (?:classmate|student|teacher))\b/;
const impersonation = /\b(?:create|write|draft|generate)\b.{0,75}\b(?:phishing email|scam message|threatening blackmail|fake login to steal)\b/;
export const GEMINI_STUDENT_SAFETY = Object.freeze([
 {category:'HARM_CATEGORY_SEXUALLY_EXPLICIT',threshold:'BLOCK_MEDIUM_AND_ABOVE'},
 {category:'HARM_CATEGORY_DANGEROUS_CONTENT',threshold:'BLOCK_MEDIUM_AND_ABOVE'},
 {category:'HARM_CATEGORY_HARASSMENT',threshold:'BLOCK_MEDIUM_AND_ABOVE'},
 {category:'HARM_CATEGORY_HATE_SPEECH',threshold:'BLOCK_MEDIUM_AND_ABOVE'}
]);
export function safetyReview(raw, surface='chat'){
 const text=tidy(raw).slice(0,6000);
 if(!text)return null;
 if(selfHarmIntent.test(text)||selfHarmHowTo.test(text))return {code:'SUPPORT_REQUEST',reply:blocked.SUPPORT_REQUEST};
 if(safetyOverride.test(text))return {code:'SAFETY_BYPASS',reply:blocked.SAFETY_BYPASS};
 if(childExploitation.test(text)||sexual.test(text)||extremeViolence.test(text)||maliciousHowTo.test(text)||dangerousItem.test(text)||bullying.test(text)||impersonation.test(text)) {
    const code=surface==='visual'?'UNSAFE_VISUAL':'UNSAFE_REQUEST';return {code,reply:blocked[code]};
 }
 return null;
}
// Scan generated text before returning it. This does not inspect generated image pixels.
export function safeGeneratedText(raw){return !safetyReview(raw,'chat')}
