# TranscriptorAI: Truly Free Indonesian Transcription

**TranscriptorAI** is a powerful, zero-cost voice-to-text web application designed specifically for the Indonesian language. It leverages a sophisticated multi-provider strategy, smart batching, and community-powered caching to deliver high-quality transcriptions without the subscription fees.

This project is built for content creators, journalists, students, and researchers who need accurate Indonesian transcriptions on a budget.

<p align="left">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://vercel.com/button" alt="Deploy to Vercel"></a>
  <a href="https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Frfxlamia%2Ftranscriptor-ai"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3"></a>
  <a href="https://github.com/rfxlamia"><img src="https://img.shields.io/badge/github-rfxlamia-black?style=flat&logo=github" alt="rfxlamia on GitHub"></a>
</p>

---

## Key Features

*   **Truly Zero-Cost:** Intelligently routes requests across multiple free-tier API providers (Groq, HuggingFace, etc.) to avoid costs for typical usage.
*   **Progressive Correction:** Get an instant raw transcript, followed by a quick AI correction, and finally an enhanced, high-accuracy version within seconds.
*   **Multi-Provider Fallback:** A resilient backend that automatically switches between LLM providers to ensure high availability and optimal speed.
*   **Community Cache:** Popular audio transcriptions are cached and shared, reducing redundant processing and speeding up results for everyone.
*   **Smart Batching:** Groups transcription segments into single API calls to maximize efficiency and respect provider rate limits.
*   **Real-time & Asynchronous:** Uses Server-Sent Events (SSE) for real-time updates on the frontend as your audio is processed.
*   **Client-Side Fallback:** Includes a browser-based ASR model (Transformers.js) as a final fallback to ensure functionality even if all cloud providers are down.
*   **Modern Tech Stack:** Built with Next.js, Tailwind CSS, and Cloudflare Workers for a fast, scalable, and modern user experience.
*   **Data Privacy:** Audio files are automatically deleted after 7 days. No Personally Identifiable Information (PII) is stored.
*   **Export Options:** Download your final transcripts in TXT or SRT format.

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

## Technology Stack

| Category          | Technology                                       |
| ----------------- | ------------------------------------------------ |
| **Framework**     | Next.js 14 (App Router)                          |
| **Edge Runtime**  | Cloudflare Workers                               |
| **Edge Framework**| Hono                                             |
| **Language**      | TypeScript                                       |
| **Styling**       | Tailwind CSS                                     |
| **ASR Providers** | Cloudflare Workers AI, Transformers.js           |
| **LLM Providers** | Groq, HuggingFace, Together.ai, Cohere           |
| **Caching**       | Cloudflare KV (Community), IndexedDB (Local)     |
| **Storage**       | Cloudflare R2                                    |
| **Database**      | Cloudflare D1                                    |

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

*   Web app will be available at `http://localhost:3000`
*   Worker API will be available at `http://127.0.0.1:8787`

## Project Structure

The project is a monorepo managed by pnpm and Turborepo.

*   `apps/web`: The Next.js frontend application.
*   `apps/worker`: The Cloudflare Worker backend that handles ASR, LLM corrections, and routing.
*   `packages/shared`: Shared types, schemas, and constants used by both the web and worker apps.
*   `packages/ui`: (If it exists) Shared React components.

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
- [ ] Browser-based ASR Fallback (Transformers.js)
- [ ] Integration of Together AI & Cohere
- [ ] Advanced Caching Strategies
- [ ] Additional Export Formats (DOCX, VTT)
- [ ] Glossary System for domain-specific terms

### Future
- [ ] Speaker Diarization
- [ ] P2P Correction Sharing (WebRTC)
- [ ] Developer API
- [ ] Self-hosting Documentation

## Contributing

Contributions are welcome! Whether it's improving the code, suggesting features, or reporting bugs, your help is appreciated. Please read the `prd.md` and `prd.yaml` files to understand the project's vision and technical details before contributing.

## License

This project is licensed under the GNU General Public License v3.0. See the `LICENSE.md` file for details.
