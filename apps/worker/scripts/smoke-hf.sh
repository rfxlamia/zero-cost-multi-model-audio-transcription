#!/usr/bin/env bash
set -euo pipefail

# This script starts wrangler dev with Groq disabled to force HF fallback.
# Requires HF_API_TOKEN in .dev.vars (or remote secrets) and no GROQ_API_KEY or DISABLE_GROQ=1.

cd "$(dirname "$0")/.."

if ! grep -q '^DISABLE_GROQ=' .dev.vars 2>/dev/null; then
  echo 'DISABLE_GROQ="1"' >> .dev.vars
fi

(timeout 90s wrangler dev src/index.ts --local --port 8810 >/tmp/wdev_hf.log 2>&1 &) 
sleep 8
echo '--- calling /api/correct/batch ---'
curl -s -X POST http://127.0.0.1:8810/api/correct/batch \
  -H 'content-type: application/json' \
  --data '{"segments":[{"audioHash":"hf1","text":"coba perbaiki kalimat ini","mode":"quick"}]}' | tee /tmp/wdev_hf.out
echo
echo '---- wrangler logs (tail) ----'
tail -n 120 /tmp/wdev_hf.log || true

