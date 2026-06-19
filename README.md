# Dragon Heart

*A warm, local space for being **with** AI characters who remember you — not querying them.*

Dragon Heart is a Windows desktop app for persistent, character-driven conversation, powered entirely locally by [Ollama](https://ollama.com) and Gemma 4. Where most chat tools are productivity surfaces ("operate a machine that produces output"), Dragon Heart is built on the opposite metaphor: you are in a relationship with someone who exists between sessions, has a stable interior life (the **Soul Document**), and responds out of who they are.

This repository implements **Phases 0–2** of the concept plan: the engine spine, the core one-on-one experience, and depth (long-term memory, lorebook, the Studio, personas, voice/multimodality, and the persona test harness).

---

## What's here

- **A warm messaging UI** — the candlelit "hearthside" design system: you open on a *face*, not a prompt box. Streaming replies, presence ("gathering her thoughts"), the interface receding. Dark + a light "Luminous Realm" theme.
- **The Layered Context Model** — every turn composes the model's context from independent layers: Soul Document → user/persona → relationship → triggered lore + recalled memory → scene → recent history, fit to a managed `num_ctx` budget.
- **Two-tier memory** — recent turns kept verbatim; older turns rolled up (summarized by the local model) into durable, inspectable memories that are recalled semantically (embeddings) or by keyword when relevant.
- **The Studio** — inspect/edit the Soul Document, memories, lorebook, the relationship, your personas, the model machinery, and a **persona test harness** (run a fixed battery of "soul probes" after edits).
- **Character cards** — import/export the community PNG/JSON character-card format.

## Architecture

```
src/engine/      pure TypeScript engine — NO UI dependencies (plan §3)
                 ollama · context assembler · memory · lorebook · repositories
src/adapters/    Db + OllamaTransport ports wired to Tauri plugins / Rust
src/state/       app store (useSyncExternalStore)
src/ui/          design-system components (ds/) + screens
src-tauri/       thin Rust shell: SQLite plugin + a reqwest Ollama proxy that
                 streams NDJSON to the webview over a Channel (no CORS)
```

The engine reaches the outside world only through injected ports (`Db`, `OllamaTransport`, `Clock`), so it is fully unit-testable and the desktop shell is swappable.

## Prerequisites

- [Ollama](https://ollama.com) running locally (`http://localhost:11434`).
- Models: a chat model (default `gemma4:26b`, fast `gemma4:e4b`) and an embedding model (`nomic-embed-text`) for semantic recall.
- Node 18+, Rust (MSVC toolchain), and the Tauri prerequisites (WebView2).

## Develop

```bash
npm install
npm run tauri dev        # launch the app
npm test                 # engine unit tests (36)
npm run build            # typecheck + bundle the frontend
npm run tauri build      # produce the desktop bundle
```

Live engine ↔ Ollama integration tests (require a running Ollama):

```bash
DH_LIVE=1 NODE_OPTIONS=--experimental-sqlite npx vitest run live
```

## Notes

- **`num_ctx` is always set explicitly** (default 16K). Ollama silently defaults Gemma to 4K, which is fatal for a memory-driven app.
- Memory extraction only *proposes*; you curate everything in the Studio — a wrong "memory" is worse than a forgotten one.
- Fonts load from Google Fonts (the design system's choice); the app degrades to system serifs offline.

Powered by Ollama + Gemma 4. Built on the "candlelit hearthside" design system.
