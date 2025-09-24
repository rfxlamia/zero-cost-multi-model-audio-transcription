# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Project Architecture

### Monorepo Structure

This is a pnpm workspace with Turborepo coordination:

- **`apps/web`**: Next.js 15 frontend with App Router
- **`apps/worker`**: Cloudflare Worker backend using Hono framework
- **`packages/shared`**: Shared TypeScript types, utilities, and constants

### Core Architecture: Multi-Provider Transcription Pipeline

The system implements a **truly zero-cost Indonesian transcription service** through intelligent provider cascading and community caching.

#### Progressive Enhancement Pipeline

```
ASR (raw) → Quick correction → Enhanced correction
```

1. **ASR Stage**: Cloudflare Workers AI (primary) + Transformers.js (browser fallback)
2. **Quick Correction**: Fast LLM for immediate results (<3s)
3. **Enhanced Correction**: Higher-quality LLM processing in background

#### Provider Cascade Strategy

The router intelligently switches between providers to maximize free-tier usage:

- **Primary**: Groq (14,400 req/day)
- **Secondary**: HuggingFace (1,000 req/day)
- **Tertiary**: Together AI ($25 credit)
- **Quaternary**: Cohere (3,000 trial)
- **Fallback**: Browser-only Transformers.js

#### Smart Batching System

- Groups 5 segments per LLM request to respect rate limits
- Mode-aware flush timers (quick vs enhanced)
- Background scheduling to optimize quota usage

### Key Components

#### Backend Worker (`apps/worker`)

- **Router**: `src/services/router.ts` - Provider cascade logic
- **Batching**: `src/services/batching.ts` - Intelligent request grouping
- **Quota Management**: `src/services/quota.ts` - Rate limiting and usage tracking
- **Caching**: `src/utils/cache.ts` - Multi-layer caching strategy
- **Providers**: `src/providers/` - Individual LLM provider implementations

#### Frontend Web App (`apps/web`)

- **SSE Integration**: Real-time progress updates via Server-Sent Events
- **Progressive UI**: Shows raw → quick → enhanced transcription stages
- **Provider Status**: Live quota monitoring and fallback indicators
- **Export Pipeline**: TXT/SRT/VTT/JSON format support

#### Shared Package (`packages/shared`)

- **Types**: Core TypeScript interfaces for TranscriptionJob, ProviderStatus, etc.
- **Constants**: Provider limits, API endpoints, cache keys
- **Utilities**: Export helpers, text processing, timestamp formatting

### Data Flow

1. **Upload**: Audio chunked into 30-second segments
2. **ASR**: Each chunk processed by Workers AI or Transformers.js
3. **Community Cache Check**: Skip LLM if correction exists
4. **LLM Correction**: Batch processing through provider cascade
5. **Progressive Enhancement**: Quick → Enhanced stages
6. **Export**: Multiple format generation with precise timestamps

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

### Zero-Cost Strategy

The project achieves true $0 operational cost through:

- **Smart Quota Management**: Pre-emptive provider switching
- **Community Caching**: Shared corrections reduce API calls
- **Request Optimization**: Batching and deduplication
- **Browser Fallback**: Transformers.js when all quotas exhausted

### Testing Strategy

- **Provider Cascade Tests**: Simulate quota exhaustion scenarios
- **Cache Effectiveness**: Validate >60% hit rates for common audio
- **Network Resilience**: Test disconnection/reconnection flows
- **Memory Stability**: Ensure no leaks during extended use
- **Accuracy Validation**: Word Error Rate benchmarking

### Security & Privacy

- **Auto-deletion**: All audio files removed after 7 days
- **Anonymous Processing**: No PII stored, UUID-based user identification
- **Rate Limiting**: Per-IP and per-user request limits
- **Content Security**: DOMPurify sanitization, strict CSP headers

## Important Implementation Notes

- **Always run lint/typecheck**: Use `pnpm lint` and check for TypeScript errors before committing
- **Provider abstraction**: All LLM providers implement the same interface for easy switching
- **Cache-first approach**: Always check community and response caches before API calls
- **Graceful degradation**: System remains functional even if all cloud providers fail
- **Quota awareness**: Monitor provider limits and switch proactively, not reactively

## Environment Setup

### Worker Variables (Cloudflare Secrets)

- `GROQ_API_KEY`, `HF_API_TOKEN`, `TOGETHER_API_KEY`, `COHERE_API_KEY`
- `APP_SECRET` for signing/nonces
- `ORIGIN_WHITELIST` for CORS

### Frontend Variables

- `NEXT_PUBLIC_API_BASE` - Worker URL
- `NEXT_PUBLIC_ENABLE_TRANSFORMERS` - Browser fallback toggle

See `apps/worker/wrangler.toml` for complete binding configuration and README.md for detailed environment setup instructions.
