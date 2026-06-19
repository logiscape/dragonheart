---
name: dragonheart-stack
description: Project Dragon Heart — tech stack, architecture decisions, and Ollama setup for the local AI character companion app
metadata:
  type: project
---

Dragon Heart is a Windows desktop app for warm, persistent conversations with AI characters (Soul Documents), powered locally by Ollama. Building Phases 0–2 of `Dragon_Heart_Concept_Plan.md`.

**Stack (decided 2026-06-18):** Tauri v2 (cargo 1.92, tauri-cli 2.9.6, host `x86_64-pc-windows-msvc`, WebView2 149) + React 18 + Vite + TypeScript. Node 22.18.

**Architecture:** Pure-TS engine in `src/engine/` (no UI deps — Ollama client, layered context assembler, memory, lorebook, repositories) behind injected ports. Tauri thin shell in `src-tauri/` provides I/O: `tauri-plugin-sql` (SQLite + migrations) and a small Rust `reqwest` layer streaming Ollama NDJSON via `tauri::ipc::Channel` (avoids CORS + gives token streaming). Engine is portable so it could later back a web/PHP surface (plan §3).

**Ollama:** `/api/chat` honors `system` role (verified). Chat models return 501 on `/api/embed` — embeddings need a dedicated model: pulling `nomic-embed-text` (configurable). Must set `num_ctx` explicitly (plan: default 16K–32K) — Ollama silently defaults Gemma to 4K. Installed chat models include `gemma4:26b` (default main), `gemma4:e4b` (fast), `gemma4:12b/31b/e2b`, qwen3.x.

**Design system:** `Dragon_Heart_Design_System.zip` extracted to `.design-system/` (gitignored ref). "Candlelit hearthside" aesthetic — warm dark default + light "Luminous Realm" theme. Tokens CSS copied to `src/styles/tokens/`, components ported to `src/ui/ds/*.tsx`. See [[dragonheart-design-language]].

**Status (2026-06-18):** Phases 0–2 implemented and verified. Layout: `src/engine/` (pure TS engine + `__tests__/`), `src/adapters/` (tauriDb/tauriOllama/tauriFiles), `src/state/store.ts`, `src/ui/{ds,screens,components}`, `src-tauri/` (Rust: `ollama.rs` streaming proxy + `files.rs`). Verified: `npx tsc --noEmit` clean, 36 vitest unit tests pass, 4 live integration tests pass against real Ollama, `npm run build` + `npm run tauri build` succeed.

**Gotchas (non-obvious):**
- npm optional-deps bug on Windows: had to manually `npm i -D @rollup/rollup-win32-x64-msvc@<v>` and `@tauri-apps/cli-win32-x64-msvc@<v>` (versions must match the parent package) or vite/tauri CLI fail with MODULE_NOT_FOUND for the native `.node`.
- JSX is **classic** runtime (`tsconfig jsx:"react"` + `react({jsxRuntime:"classic"})`) so ported components keep `import React`.
- App tsconfig sets `types:[]` and excludes `**/__tests__/**`; tests have their own `tsconfig.test.json` (uses `@types/node`). Build typecheck would otherwise choke on the Node-based `live.test.ts`.
- Live tests: `DH_LIVE=1 NODE_OPTIONS=--experimental-sqlite npx vitest run live` (uses `node:sqlite` via runtime `createRequire` so Vite doesn't pre-resolve it; flag required on Node 22).
- Engine SQL uses `?` placeholders; `tauriDb` translates to `$1,$2…` for SQLx; `node:sqlite` test adapter uses `?` directly.
- `embeddinggemma`/chat models return 501 on `/api/embed` — only dedicated embed models (nomic-embed-text) work.
