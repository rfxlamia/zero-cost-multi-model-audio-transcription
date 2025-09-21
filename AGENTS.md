# Repository Guidelines

## Project Structure & Module Organization
This Turborepo houses three core workspaces: `apps/web` (Next.js App Router UI, recorder, SSE client), `apps/worker` (Cloudflare Worker with Hono, LLM routing, quotas), and `packages/shared` (types, constants, schema). Keep React features under `apps/web/src`, worker routes and services in `apps/worker/src`, and reusable logic in `packages/shared/src`. Store co-located tests as `*.test.ts` next to the source and mirror folder names when adding new features.

## Build, Test, and Development Commands
- `pnpm i`: install all workspace dependencies (Node 20+).
- `pnpm dev`: run web and worker dev servers in parallel.
- `pnpm -F @transcriptorai/web dev`: launch only the Next.js app; worker equivalent exists.
- `pnpm build` / `pnpm -F <pkg> build`: produce production bundles.
- `pnpm lint` and `pnpm format`: apply ESLint and Prettier rules.
- `pnpm -F @transcriptorai/worker test`: execute Vitest suite for the worker API.

## Coding Style & Naming Conventions
TypeScript is strict and linted via ESLint; follow React function components and hooks. Prettier enforces 2-space indent, single quotes, no semicolons, and 100-character width. Use PascalCase for types (`TranscriptionJob`), camelCase for functions and variables, kebab-case for file names, and UPPER_SNAKE_CASE for constants.

## Testing Guidelines
Worker logic uses Vitest; prioritize routing flows, SSE payloads, fallback chains, and quota counters with mocked KV/R2/D1 bindings. Name specs `src/**/*.test.ts` and keep them fast (<500ms median). Run tests before pushing and add regression cases for new cloud interactions or streaming states.

## Commit & Pull Request Guidelines
Adopt Conventional Commits (e.g., `feat(worker): add llm fallback router`) to satisfy commitlint. Before opening a PR, ensure `pnpm lint` and relevant builds pass, link the tracking issue, and attach UI screenshots when web surfaces change. Summarize scope (`web/worker/shared`), highlight risk areas, and note any missing coverage.

## Security & Configuration Tips
Manage secrets through Wrangler bindings: `GROQ_API_KEY`, `HF_API_TOKEN`, `TOGETHER_API_KEY`, `COHERE_API_KEY`, `APP_SECRET`, plus KV stores (`COMMUNITY_CACHE`, `RESPONSE_CACHE`, `QUOTA_COUNTERS`, `JOB_STATE`), `R2_BUCKET`, and `DB`. The web app reads `NEXT_PUBLIC_API_BASE` and `NEXT_PUBLIC_ENABLE_TRANSFORMERS`; align CORS with `ORIGIN_WHITELIST` when adding environments.
