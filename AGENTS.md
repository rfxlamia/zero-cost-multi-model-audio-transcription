# Repository Guidelines

## Project Structure & Module Organization

- apps/web: Next.js App Router (TypeScript, Tailwind). UI, recorder/uploader, SSE client.
- apps/worker: Cloudflare Worker (Hono). Orchestrator API, SSE, LLM router, quotas, cache.
- packages/shared: Types (TranscriptionJob, TranscriptionChunk, ProviderUsage), constants, schema.sql.
- Root: Turborepo, ESLint/Prettier, Husky + lint-staged, Commitlint, PNPM workspaces.

## Build, Test, and Development Commands

- Install: `pnpm i` (Node >= 20).
- Dev (all): `pnpm dev` (parallel). Web: `pnpm -F @transcriptorai/web dev`. Worker: `pnpm -F @transcriptorai/worker dev`.
- Build: `pnpm build` atau `pnpm -F <pkg> build`.
- Lint/Format: `pnpm lint`, `pnpm format`.
- Test (worker): `pnpm -F @transcriptorai/worker test` (Vitest).

## Architecture & Pipeline (MVP)

- ASR: Workers AI (utama, 10 menit/hari) → fallback Transformers.js (browser) bila limit/online issue.
- LLM Corrector: Fallback berurutan Groq → HuggingFace → Together → Cohere → Local.
- Progressive enhancement: raw → quick → enhanced, streaming via SSE.
- Smart batching: 5 segmen per panggilan LLM; hormati rate/kuota dan concurrency (≤5).
- Caching: Cloudflare KV (response & community); R2 untuk audio; D1 untuk telemetry/usage.
- Guardrails zero-cost: dedupe `audioHash`, preemptive switch saat kuota hampir habis.

## Coding Style & Naming Conventions

- TypeScript strict; React FC + hooks. Explicit return/boundary types (ESLint).
- Prettier: 2 spasi, single quotes, no semicolons, width 100.
- Penamaan: Types PascalCase (`TranscriptionJob`), constants UPPER_SNAKE (`BATCH_SIZE`), file kebab-case.

## Testing Guidelines

- Fokus worker: routing, SSE payload, fallback router, quota counters, cache hits (mock KV/R2/D1).
- Penamaan: `src/**/*.test.ts`. Target p50 API <500ms (mock latencies).

## Commit & Pull Request Guidelines

- Conventional Commits (commitlint). Contoh: `feat(worker): add LLM fallback router`.
- PR: jelaskan scope (web/worker/shared), link issue, screenshot UI (jika ada). Pastikan `pnpm lint` dan build hijau.

## Security & Configuration Tips

- Worker secrets: GROQ_API_KEY, HF_API_TOKEN, TOGETHER_API_KEY, COHERE_API_KEY, APP_SECRET.
- Wrangler bindings: KV (COMMUNITY_CACHE, RESPONSE_CACHE, QUOTA_COUNTERS, JOB_STATE), R2_BUCKET, DB, AI.
- Web env: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_ENABLE_TRANSFORMERS`. CORS dari `ORIGIN_WHITELIST`.
