#!/usr/bin/env bash
set -euo pipefail

TARGET="${WORKER_URL:-http://localhost:8787}"
if ! curl -sf "$TARGET/api/health" >/dev/null 2>&1; then
  echo "[perf] Target $TARGET/api/health tidak dapat dijangkau. Pastikan worker berjalan atau set WORKER_URL."
  exit 1
fi

if command -v k6 >/dev/null 2>&1; then
  echo '[perf] Running k6 smoke test'
  k6 run tests/perf/k6-smoke.js
else
  echo '[perf] k6 tidak ditemukan, melewati tahap k6'
fi

if command -v artillery >/dev/null 2>&1; then
  echo '[perf] Menjalankan skenario Artillery ke' "$TARGET"
  artillery run tests/perf/artillery.yml --target "$TARGET"
else
  echo '[perf] artillery tidak ditemukan. Install dengan "pnpm add -g artillery" atau gunakan `pnpm exec artillery`.'
  exit 1
fi
