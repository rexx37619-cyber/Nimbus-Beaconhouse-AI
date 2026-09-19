# Nimbus workspace — official Puter model references

The private workspace uses Puter.js for its chat-agent calls. The exact model IDs used by this build are:

- `openai/gpt-5.6-sol` — Nimbus Sol 5.6 • Ultra Modified
- `anthropic/claude-fable-5` — Nimbus Fable 5 • Ultra Modified
- `anthropic/claude-opus-5` — Nimbus Opus 5 • Ultra Modified

The code uses the documented Puter.js pattern:

```javascript
const response = await puter.ai.chat("Explain quantum computing", {
  model: "openai/gpt-5.6-sol"
});
const text = response?.message?.content ?? "";
```

Official references:
- https://developer.puter.com/ai/openai/gpt-5.6-sol/
- https://developer.puter.com/ai/models/
- https://docs.puter.com/AI/chat/
- https://docs.puter.com/AI/listModels/

Puter's User-Pays model means the developer does not pay the integration/infrastructure cost, while each signed-in user account covers its own AI usage. It does not guarantee unlimited usage on a depleted account.
