Untuk versi Bahasa Indonesia, silakan lihat [README-id.md](./README-id.md).

# TranscriptorAI: Truly Free Indonesian Transcription

**TranscriptorAI** is a powerful, zero-cost voice-to-text web application designed specifically for the Indonesian language. It leverages a sophisticated multi-provider strategy, smart batching, and community-powered caching to deliver high-quality transcriptions without the subscription fees.

This project is built for content creators, journalists, students, and researchers who need accurate Indonesian transcriptions on a budget.

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://img.shields.io/badge/Deploy%20to-Vercel-black?style=flat-square&logo=vercel" alt="Deploy to Vercel"></a>
  <a href="https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://img.shields.io/badge/Deploy%20to-Cloudflare-F38020?style=flat-square&logo=cloudflare" alt="Deploy to Cloudflare Workers"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License: MIT"></a>
  <a href="https://github.com/rfxlamia"><img src="https://img.shields.io/badge/GitHub-rfxlamia-181717?style=flat-square&logo=github" alt="rfxlamia on GitHub"></a>
</p>

---

## Key Features

- **Truly Zero-Cost:** Intelligently routes requests across multiple free-tier API providers (Groq, HuggingFace, etc.) to avoid costs for typical usage.
- **Progressive Correction:** Get an instant raw transcript, followed by a quick AI correction, and finally an enhanced, high-accuracy version within seconds.
- **Multi-Provider Fallback:** A resilient backend that automatically switches between LLM providers to ensure high availability and optimal speed.
- **Community Cache:** Popular audio transcriptions are cached and shared, reducing redundant processing and speeding up results for everyone.
- **Smart Batching:** Groups transcription segments into single API calls to maximize efficiency and respect provider rate limits.
- **Real-time & Asynchronous:** Uses Server-Sent Events (SSE) for real-time updates on the frontend as your audio is processed.
- **Client-Side Fallback:** Includes a browser-based ASR model (Transformers.js) as a final fallback to ensure functionality even if all cloud providers are down.
- **Modern Tech Stack:** Built with Next.js, Tailwind CSS, and Cloudflare Workers for a fast, scalable, and modern user experience.
- **Data Privacy:** Audio files are automatically deleted after 7 days. No Personally Identifiable Information (PII) is stored.
- **Export Options:** Download your final transcripts in TXT or SRT format.

## Architecture Overview

The system is designed as a monorepo with a Next.js frontend and a Cloudflare Worker backend that acts as an intelligent orchestrator.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Browser UI    │─────▶│  CF Worker Edge  │─────▶│  Workers AI     │
│  Next.js/React  │◀─────│   (Orchestrator) │◀─────│  (ASR Primary)  │
└─────────────────┘ SSE  └──────────────────┘      └─────────────────┘
        │                         │                          │
        │                         ▼                     [Fallback]
        │                 ┌──────────────────┐              ▼
        │                 │  Smart LLM Router│     ┌─────────────────┐
        │                 └──────────────────┘     │ Transformers.js │
        │                         │                 │  (Browser ASR)  │
        ▼                         ▼                 └─────────────────┘
┌─────────────────┐      ┌──────────────────┐
│  IndexedDB      │      │   Multi-Provider  │
│  Local Cache    │      │   LLM Fallback    │
└─────────────────┘      │  ┌────────────┐  │
                         │  │   Groq     │  │
┌─────────────────┐      │  ├────────────┤  │
│  Community      │◀────▶│  │HuggingFace │  │
│  Cache (KV)     │      │  ├────────────┤  │
└─────────────────┘      │  │ Together   │  │
                         │  ├────────────┤  │
                         │  │  Cohere    │  │
                         │  └────────────┘  │
└──────────────────┘
```

### Progressive Pipeline (3‑Stage)

```
ASR (raw) → Quick correction → Enhanced correction
  │               │                   │
  ├─ send SSE: raw(chunk)            │
  ├─ cache: RESPONSE_CACHE:raw       │
  ▼                                   ▼
 emit SSE quick(chunk)               emit SSE enhanced(chunk)
 update JOB_STATE.final = quick      update JOB_STATE.final = enhanced
 cache quick                         cache enhanced
```

SSE event types: `status`, `raw`, `quick`, `enhanced`, `done`, `error`.

## Technology Stack

| Category           | Technology                                   |
| ------------------ | -------------------------------------------- |
| **Framework**      | Next.js 14 (App Router)                      |
| **Edge Runtime**   | Cloudflare Workers                           |
| **Edge Framework** | Hono                                         |
| **Language**       | TypeScript                                   |
| **Styling**        | Tailwind CSS                                 |
| **ASR Providers**  | Cloudflare Workers AI, Transformers.js       |
| **LLM Providers**  | Groq, HuggingFace, Together.ai, Cohere       |
| **Caching**        | Cloudflare KV (Community), IndexedDB (Local) |
| **Storage**        | Cloudflare R2                                |
| **Database**       | Cloudflare D1                                |

## Quick Start

- One‑liner dev: `pnpm i && pnpm dev`

This runs the Next.js web app and the Cloudflare Worker orchestrator together via Turborepo.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/rfxlamia/transcriptor-ai.git
cd transcriptor-ai
```

### 2. Install Dependencies

This is a pnpm monorepo.

```bash
pnpm install
```

### 3. Set Up Environment Variables

The backend worker requires API keys to function. Create a `.dev.vars` file in the `apps/worker` directory:

`apps/worker/.dev.vars`:

```ini
# Whitelisted origin for local development
ORIGIN_WHITELIST="http://localhost:3000"

# Optional: Set a logging level (info, debug, error)
LOG_LEVEL="info"

# --- Provider API Keys (at least one is recommended) ---
# Get from https://console.groq.com/keys
GROQ_API_KEY="..."

# Get from https://huggingface.co/settings/tokens
HF_API_TOKEN="..."

# You can add other provider keys here as they are integrated
# TOGETHER_API_KEY="..."
# COHERE_API_KEY="..."
```

### 4. Run the Development Servers

This command uses `turbo` to run the Next.js web app and the Cloudflare Worker simultaneously.

```bash
pnpm dev
```

- Web app will be available at `http://localhost:3000`
- Worker API will be available at `http://127.0.0.1:8787`

## Environment Variables & Bindings

Worker (Cloudflare)

| Key                | Required    | Description                                                     |
| ------------------ | ----------- | --------------------------------------------------------------- | ------ | -------- |
| `ORIGIN_WHITELIST` | yes         | Comma‑separated allowed origins for CORS.                       |
| `LOG_LEVEL`        | no          | `info`                                                          | `warn` | `error`. |
| `APP_SECRET`       | recommended | Used for light signing/nonces.                                  |
| `GROQ_API_KEY`     | optional    | Enables Groq provider; disable via `DISABLE_GROQ=1`.            |
| `HF_API_TOKEN`     | optional    | Enables Hugging Face Inference API; disable via `DISABLE_HF=1`. |
| `TOGETHER_API_KEY` | optional    | Reserved for Together provider.                                 |
| `COHERE_API_KEY`   | optional    | Reserved for Cohere provider.                                   |
| `DISABLE_GROQ`     | no          | `'1'` or `true` to skip Groq in router.                         |
| `DISABLE_HF`       | no          | `'1'` or `true` to skip HF in router.                           |

Frontend (Next.js)

| Key                               | Required | Description                                                               |
| --------------------------------- | -------- | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE`            | yes      | Base URL of Worker orchestrator (e.g. `https://your-worker.workers.dev`). |
| `NEXT_PUBLIC_ENV`                 | no       | `development` or `production`.                                            |
| `NEXT_PUBLIC_ENABLE_TRANSFORMERS` | no       | Gate browser fallback (Transformers.js).                                  |

Wrangler Bindings (apps/worker/wrangler.toml)

| Binding           | Type       | Purpose                                                |
| ----------------- | ---------- | ------------------------------------------------------ | ---- | ----------- |
| `COMMUNITY_CACHE` | KV         | Community‑submitted corrections (text + meta).         |
| `RESPONSE_CACHE`  | KV         | Correction cache by signature `sha256(audioHash        | mode | glossary)`. |
| `QUOTA_COUNTERS`  | KV         | Minute/day counters, provider success/failure metrics. |
| `JOB_STATE`       | KV         | Per‑job state (chunks, timestamps, stage).             |
| `R2_BUCKET`       | R2         | Audio storage (original/chunks/artifacts).             |
| `DB`              | D1         | Telemetry and usage tables (optional).                 |
| `AI`              | Workers AI | Primary ASR (Whisper‑equivalent) binding.              |

Quota & Limits (defaults)

- LLM batch size: 5 segments
- Minute limits (examples): Groq 30/min; Cohere 100/min
- Day limits (examples): Groq 14,400/day; HF 1,000/day
- Response cache TTL: 7 days

See `packages/shared/constants/index.ts` and `apps/worker/src/services/quota.ts`.

## Project Structure

The project is a monorepo managed by pnpm and Turborepo.

- `apps/web`: The Next.js frontend application.
- `apps/worker`: The Cloudflare Worker backend that handles ASR, LLM corrections, and routing.
- `packages/shared`: Shared types, schemas, and constants used by both the web and worker apps.
- `packages/ui`: (If it exists) Shared React components.

## Roadmap

Our goal is to continuously improve the accuracy, speed, and feature set of TranscriptorAI while adhering to the "truly free" philosophy.

### Week 1-2 (Core MVP)

- [x] Monorepo & Cloudflare Worker Setup
- [x] Groq + HuggingFace Integration with Fallback
- [x] Smart Batching & Quota Management
- [x] Progressive Enhancement Pipeline (Quick + Enhanced)
- [x] Community Cache with Cloudflare KV
- [x] Frontend SSE Integration & Transcript Viewer

### Week 3-4 (Enhancements)

- [x] Browser-based ASR Fallback (Transformers.js)
- [ ] Integration of Together AI & Cohere
- [ ] Advanced Caching Strategies
- [x] Additional Export Formats (TXT/SRT/VTT/JSON)
- [ ] Glossary System for domain-specific terms

### Future

- [ ] Speaker Diarization
- [ ] P2P Correction Sharing (WebRTC)
- [ ] Developer API
- [ ] Self-hosting Documentation

### Latest Session (Day 9–10 Summary)

- **Export pipeline hardened** – Added shared helpers with ±0.5 s timestamp tolerance and gap merging, refactored the worker export route, and expanded tests for TXT/SRT/VTT/JSON outputs.
- **Transformers.js fallback** – Created a client hook to lazily load `@xenova/transformers@^2.17.2`, gate by device memory and server availability, and feed local ASR results into the transcript UI with preload controls and clear status messaging.
- **Testing & debugging** – Executed `pnpm exec vitest run --pool=threads --poolOptions.threads.maxThreads=1 --poolOptions.threads.minThreads=1 --reporter=verbose` for deterministic sandbox runs; resolved dependency issues by aligning to the latest published Transformers.js release and documenting manual installs when DNS blocks npm.
- **Current blockers** – None functionally; optional telemetry for fallback usage remains a future enhancement.

### Latest Session (Day 11–12 Summary)

- **Provider cascade safeguards** – Added regression tests covering quota exhaustion and pre-emptive switching so the router consistently falls back when Groq/HF limits are reached.
- **Batching optimizations** – Mode-aware flush timers (quick vs enhanced), background flush scheduling, and latency telemetry recorded per provider to Cloudflare KV.
- **Metrics enrichment** – `/api/metrics` now exposes latency aggregates alongside quota and success data, enabling the dashboard to trend provider performance.
- **Current blockers** – Repo still carries legacy ESLint/TypeScript violations (implicit `any`, missing return types) that need a dedicated lint cleanup pass.

### Upcoming (Day 11–12 Targets)

- **Day 11 – Cascade & quota resilience** (`prd.md`, `prd.yaml`, `step.md`): stress provider fallback, simulate quota exhaustion, ensure pre-emptive switches, and capture recovery behaviour.
- **Day 12 – Performance & caching**: profile API latency, tune batching flush timers and prompt compression, improve KV hit ratios, optimize frontend bundles, and surface metrics in the dashboard.

## Roadmap

- **Short term (pre-MVP deploy):** Stabilize synchronous correction path with stronger caching and lightweight queue limits so `pnpm qa:all` and deployment smoke tests run tanpa timeout.
- **Post-MVP async refactor:** Migrasikan batch koreksi ke pola Cloudflare Queues (POST ➜ 202 + `jobId`, consumer Worker mengolah provider secara background, endpoint status memantau KV) untuk menghilangkan request panjang dan memberikan skalabilitas tinggi.
- **Provider & QA expansion:** Integrasi Together/Cohere, perluasan contract test per provider, dan otomatisasi evaluasi akurasi berbasis gold audio di pipeline CI.

## Contributing

## Deployment Guide

Cloudflare Workers (orchestrator)

1. Configure bindings in `apps/worker/wrangler.toml` (KV, R2, D1, AI).
2. Set secrets:

```bash
cd apps/worker
wrangler secret put GROQ_API_KEY
wrangler secret put HF_API_TOKEN
wrangler secret put APP_SECRET
# optional: TOGETHER_API_KEY, COHERE_API_KEY, TURNSTILE_SECRET
```

3. Deploy:

```bash
pnpm -F @transcriptorai/worker deploy
```

Next.js (Vercel or Cloudflare Pages)

1. Set `NEXT_PUBLIC_API_BASE` to the Worker URL.
2. Deploy via provider UI/CLI.

Cloudflare Pages (+ Functions) is supported; this repo assumes the Worker orchestrator is separate for clearer scaling and quotas.

## API Reference

Public routes (Worker)

- `GET /` → Health text
- `GET /api/health` → KV/R2/D1 pings
- `GET /api/quotas` → Minute/day counters per provider
- `GET /api/metrics` → Provider status, success/failure rates, queue/semaphore stats (rate‑limited, cached)
- `POST /api/transcribe/start` → Initialize job; returns `{ id, status }`
- `POST /api/transcribe/:id/chunk` → Append/replace chunk `{ audioHash, text, index?, startTime?, endTime? }`
- `GET /api/transcribe/:id/stream` → SSE stream of `status/raw/quick/enhanced/done`
- `POST /api/correct/batch` → Batch correction (internal use); cache‑first
- `POST /api/community/submit` → Submit community correction `{ audioHash, text, ... }`
- `POST /api/community/upvote` → Upvote community entry `{ audioHash }`
- `GET /api/export/:id.(txt|srt|vtt|json)` → Export transcript

SSE payload examples

```json
{ "type":"status", "jobId":"...", "status":"transcribing" }
{ "type":"raw", "chunkIndex":3, "text":"..." }
{ "type":"quick", "chunkIndex":3, "text":"...", "provider":"router", "confidence":0.80 }
{ "type":"enhanced", "chunkIndex":0, "text":"...", "provider":"router", "confidence":0.85 }
{ "type":"done", "jobId":"..." }
```

Cache keys

- `COMMUNITY_CACHE:{audioHash}` → `{ text, corrections, contributor, upvotes }`
- `RESPONSE_CACHE:{sha256(audioHash|mode|sortedGlossary)}` → corrected text
- `QUOTA_COUNTERS:{provider}:minute:{YYYYMMDDHHmm}` → `{ used, limit }`
- `QUOTA_COUNTERS:{provider}:day:{YYYYMMDD}` → `{ used, limit, resetAt }`
- `METRICS:success|failure:{provider}:day:{YYYYMMDD}` → counts
- `JOB_STATE:{jobId}` → job snapshot (chunks, updatedAt)

Contributions are welcome! Whether it's improving the code, suggesting features, or reporting bugs, your help is appreciated. Please read the `prd.md` and `prd.yaml` files to understand the project's vision and technical details before contributing.

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.
