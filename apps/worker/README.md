# Worker Orchestrator — Quick API & Dev Guide

## Endpoint — Batch Correction

- Path: `POST /api/correct/batch`
- Body (JSON):
  ```json
  {
    "segments": [
      { "audioHash": "<hash>", "text": "<raw text>", "mode": "quick", "glossary": ["istilah", "khusus"] },
      { "audioHash": "<hash2>", "text": "<raw text>", "mode": "enhanced" }
    ]
  }
  ```
- Response (200):
  ```json
  {
    "provider": "groq|huggingface|cache|mixed|router|none",
    "results": [
      { "audioHash": "<hash>", "corrected": "<text>", "confidence": 0.8, "provider": "groq", "cached": false }
    ]
  }
  ```

Notes:
- Cache-first: Community cache → Response cache → Provider call.
- Smart batching: groups up to 5 items or after ~700ms flush.
- Concurrency: max 5 provider requests in parallel.

## Dev — Local Setup

Create `.dev.vars` in `apps/worker`:

```
LOG_LEVEL="info"
ORIGIN_WHITELIST="http://localhost:3000"
# Secrets (local only) — optional if you use --remote
GROQ_API_KEY="..."
HF_API_TOKEN="..."
```

Run dev:

```
wrangler dev --local --port 8787
```

Call sample:

```
curl -s -X POST http://127.0.0.1:8787/api/correct/batch \
  -H 'content-type: application/json' \
  --data '{"segments":[{"audioHash":"live1","text":"tolong perbaiki ejaan kalimat bahasa indonesia ini","mode":"quick"}]}'
```

## HF Fallback Smoke

Force HF by disabling Groq:

```
echo 'DISABLE_GROQ="1"' >> .dev.vars
wrangler dev --local --port 8810
```

Then call the same endpoint; the response provider should be `huggingface` if the HF token is set.

## Cache Keys

- Community: `COMMUNITY_CACHE:${audioHash}`
- Response: `RESPONSE_CACHE:${sha256(audioHash|mode|sortedGlossary)}`

Glossary affects cache signature; change in glossary triggers a fresh correction.

