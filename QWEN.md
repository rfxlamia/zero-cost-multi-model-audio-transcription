# TranscriptorAI Project Context

## Project Overview

TranscriptorAI is a powerful, zero-cost voice-to-text web application designed specifically for the Indonesian language. It leverages a sophisticated multi-provider strategy, smart batching, and community-powered caching to deliver high-quality transcriptions without subscription fees.

The project is built for content creators, journalists, students, and researchers who need accurate Indonesian transcriptions on a budget. It's a monorepo managed by pnpm and Turborepo containing a Next.js frontend and a Cloudflare Worker backend.

### Key Features

- **Truly Zero-Cost**: Intelligently routes requests across multiple free-tier API providers (Groq, HuggingFace, etc.)
- **Progressive Correction**: Instant raw transcript, followed by quick and enhanced AI corrections
- **Multi-Provider Fallback**: Resilient backend that automatically switches between LLM providers
- **Community Cache**: Popular audio transcriptions are cached and shared
- **Smart Batching**: Groups transcription segments into single API calls
- **Real-time & Asynchronous**: Uses Server-Sent Events (SSE) for real-time updates
- **Client-Side Fallback**: Includes browser-based ASR model as final fallback
- **Modern Tech Stack**: Next.js, Tailwind CSS, and Cloudflare Workers

## Architecture

### Project Structure

- `apps/web`: Next.js frontend application
- `apps/worker`: Cloudflare Worker backend (orchestrator)
- `packages/shared`: Shared types, schemas, and constants
- `tests/`: Unit, integration, and E2E tests
- `scripts/`: Build and utility scripts

### Core Architecture: Multi-Provider Transcription Pipeline

The system implements a progressive enhancement pipeline:

```
ASR (raw) → Quick correction → Enhanced correction
```

1. **ASR Stage**: Cloudflare Workers AI (primary) + Transformers.js (browser fallback)
2. **Quick Correction**: Fast LLM for immediate results (<3s)
3. **Enhanced Correction**: Higher-quality LLM processing in background

#### Provider Cascade Strategy

The router intelligently switches between providers:

- **Primary**: Groq (14,400 req/day)
- **Secondary**: HuggingFace (1,000 req/day)
- **Tertiary**: Together AI, Cohere
- **Fallback**: Browser-only Transformers.js

### Technology Stack

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

### Cloudflare Infrastructure

#### KV Stores

- **COMMUNITY_CACHE**: Shared community corrections
- **RESPONSE_CACHE**: Individual correction cache
- **QUOTA_COUNTERS**: Provider usage tracking
- **JOB_STATE**: Transcription job status

#### Other Bindings

- **R2_BUCKET**: Audio file storage (auto-delete after 7 days)
- **DB**: D1 database for telemetry and usage metrics
- **AI**: Workers AI binding for primary ASR

## Development Commands

### Core Development

- **Start development servers**: `pnpm dev` (runs both web and worker apps)
- **Build all projects**: `pnpm build` (web + worker)
- **Lint all code**: `pnpm lint`
- **Format code**: `pnpm format`
- **Run tests**: `pnpm test` (unit tests)

### Specific Test Types

- **Unit tests**: `pnpm test:unit`
- **Contract tests**: `pnpm test:contract`
- **Integration tests**: `pnpm test:integration`
- **End-to-end tests**: `pnpm e2e`
- **Performance tests**: `pnpm perf`
- **Lighthouse CI**: `pnpm lhci`

### Quality Assurance Suite

- **Provider testing**: `pnpm qa:provider`
- **Cache performance**: `pnpm qa:cache`
- **Concurrency testing**: `pnpm qa:concurrency`
- **Network resilience**: `pnpm qa:network`
- **Accuracy metrics**: `pnpm qa:metrics`
- **Full QA suite**: `pnpm qa:all` (runs all tests + builds + scans)

### Security & Analysis

- **Bundle analysis**: `pnpm scan:bundle`
- **License check**: `pnpm scan:licenses`
- **Secret detection**: `pnpm scan:secrets`
- **Environment check**: `pnpm preflight`

### Worker-Specific Commands

- **Deploy worker**: `pnpm -F @transcriptorai/worker deploy`
- **Worker dev mode**: `cd apps/worker && pnpm dev`
- **Worker tests**: `cd apps/worker && pnpm test:stable`

## Environment Setup

### Worker Variables (Cloudflare Secrets)

- `GROQ_API_KEY`, `HF_API_TOKEN`, `TOGETHER_API_KEY`, `COHERE_API_KEY`
- `APP_SECRET` for signing/nonces
- `ORIGIN_WHITELIST` for CORS
- `LOG_LEVEL` for logging level

### Frontend Variables

- `NEXT_PUBLIC_API_BASE` - Worker URL
- `NEXT_PUBLIC_ENABLE_TRANSFORMERS` - Browser fallback toggle

## API Reference

### Public Routes (Worker)

- `GET /` → Health text
- `GET /api/health` → KV/R2/D1 pings
- `GET /api/quotas` → Minute/day counters per provider
- `GET /api/metrics` → Provider status, success/failure rates
- `POST /api/transcribe/start` → Initialize job
- `POST /api/transcribe/:id/chunk` → Append/replace chunk
- `GET /api/transcribe/:id/stream` → SSE stream of transcription progress
- `POST /api/correct/batch` → Batch correction (internal use)
- `POST /api/community/submit` → Submit community correction
- `POST /api/community/upvote` → Upvote community entry
- `GET /api/export/:id.(txt|srt|vtt|json)` → Export transcript

### SSE Event Types

`status`, `raw`, `quick`, `enhanced`, `done`, `error`

## Development Conventions

- **Code Style**: Prettier for formatting, ESLint for linting
- **Commits**: Commitlint for conventional commit messages
- **Git Hooks**: Husky for pre-commit hooks
- **Monorepo Management**: pnpm workspaces and turbo
- **Smart Batching**: Groups 5 segments per LLM request to respect rate limits
- **Cache-First Approach**: Always check community and response caches before API calls
- **Graceful Degradation**: System remains functional even if all cloud providers fail
