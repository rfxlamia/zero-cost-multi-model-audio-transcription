# GEMINI.md

## Project Overview

This is a monorepo for a transcription AI project. It consists of a Next.js web application and a Cloudflare Worker for backend processing. The project uses pnpm for package management and turbo for building and task running.

**Technologies:**

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Cloudflare Workers, Hono
- **Build:** pnpm, turbo
- **Linting/Formatting:** ESLint, Prettier

**Architecture:**

- **`apps/web`:** A Next.js application that provides the user interface for the transcription service.
- **`apps/worker`:** A Cloudflare Worker that exposes a text correction API. It uses a cache-first strategy, smart batching, and concurrency control. It can use Groq or Hugging Face for text correction.
- **`packages/shared`:** A shared package for code that is used across the applications.

## Building and Running

**Installation:**

```bash
pnpm install
```

**Development:**

To run both the web and worker applications in development mode:

```bash
pnpm dev
```

**Building:**

To build both applications:

```bash
pnpm build
```

**Testing:**

To run the tests for the worker:

```bash
pnpm --filter @transcriptorai/worker test
```

## Development Conventions

- **Code Style:** The project uses Prettier for code formatting and ESLint for linting.
- **Commits:** The project uses commitlint to enforce conventional commit messages.
- **Git Hooks:** The project uses husky to run pre-commit hooks.
- **Monorepo Management:** The project uses pnpm workspaces and turbo to manage the monorepo.
