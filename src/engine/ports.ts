/* ============================================================
   Dragon Heart — ports.
   The engine is pure and UI-free; it reaches the outside world
   only through these injected interfaces. The Tauri app wires
   them to plugins (SQLite, the Rust Ollama proxy); tests wire
   them to in-process fakes. This is what keeps the engine
   swappable (plan §3).
   ============================================================ */

import type { OllamaChatRequest, OllamaChatChunk } from "./types";

/** Result of a write. `lastInsertId` is the rowid; we use TEXT UUID keys, so
 *  callers generate ids themselves and rarely need it. */
export interface DbResult {
  rowsAffected: number;
  lastInsertId?: number;
}

/**
 * Minimal SQL surface. SQL uses `?` positional placeholders; adapters translate
 * if their driver wants a different style. Values are bound in array order.
 */
export interface Db {
  execute(sql: string, params?: unknown[]): Promise<DbResult>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Talks to the local Ollama server. In the app this is the Rust reqwest proxy
 * (streaming chat over a Channel; plain POST/GET otherwise) — which avoids CORS
 * and gives reliable token streaming.
 */
export interface OllamaTransport {
  /** stream a chat completion; `onChunk` fires per NDJSON object. */
  chatStream(req: OllamaChatRequest, onChunk: (chunk: OllamaChatChunk) => void): Promise<void>;
  /** POST a non-streaming JSON endpoint (e.g. /api/embed). */
  post<T = unknown>(path: string, body: unknown): Promise<T>;
  /** GET a JSON endpoint (e.g. /api/tags, /api/version). */
  get<T = unknown>(path: string): Promise<T>;
}

/** Injected clock so time-dependent logic (salience decay, timestamps) is
 *  deterministic in tests. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Generate a unique id. Uses crypto.randomUUID where available. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // fallback (should not be hit in webview or modern Node)
  return "id-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}
