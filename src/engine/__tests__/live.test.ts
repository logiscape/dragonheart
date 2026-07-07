/* Live integration against a running Ollama. Opt-in:
     DH_LIVE=1 NODE_OPTIONS=--experimental-sqlite npx vitest run live
   Exercises the real turn loop end to end: schema → seed → greeting →
   streamed reply → persistence → embeddings → rollup summarization. */
import { describe, it, expect, beforeAll } from "vitest";
import { Engine } from "../index";
import type { Db, DbResult, OllamaTransport } from "../ports";
import type { OllamaChatRequest, OllamaChatChunk } from "../types";
import { makeMessage } from "./fixtures";

const LIVE = process.env.DH_LIVE === "1";

// ---- node:sqlite Db adapter (in-memory) ----
class NodeDb implements Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any) {}
  async execute(sql: string, params: unknown[] = []): Promise<DbResult> {
    const r = this.db.prepare(sql).run(...params);
    return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
  }
  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
}

// ---- fetch-based Ollama transport (NDJSON streaming) ----
class FetchOllama implements OllamaTransport {
  constructor(private readonly base = "http://localhost:11434") {}
  async chatStream(req: OllamaChatRequest, onChunk: (c: OllamaChatChunk) => void): Promise<void> {
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...req, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) {
          try {
            onChunk(JSON.parse(line));
          } catch {
            /* skip */
          }
        }
      }
    }
  }
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return (await res.json()) as T;
  }
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return (await res.json()) as T;
  }
}

describe.skipIf(!LIVE)("live engine ↔ ollama", () => {
  let engine: Engine;

  beforeAll(async () => {
    // runtime require so Vite doesn't try to pre-resolve the very-new builtin
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const { DatabaseSync } = req("node:sqlite") as { DatabaseSync: new (p: string) => unknown };
    engine = await Engine.create(new NodeDb(new DatabaseSync(":memory:")), new FetchOllama());
    await engine.updateSettings({
      defaultModel: "gemma4:e4b",
      fastModel: "gemma4:e4b",
      numCtx: 8192,
      semanticRecall: true,
      embeddingModel: "nomic-embed-text",
    });
    await engine.setUserName("Tester");
    await engine.markOnboarded();
    await engine.seedStartersIfEmpty();
  });

  it("seeds the starter circle", async () => {
    const chars = await engine.listCharacters();
    expect(chars.length).toBeGreaterThanOrEqual(1);
    expect(chars.some((c) => c.name.includes("Elara"))).toBe(true);
  });

  it("opens with an authored greeting and streams a persisted reply", async () => {
    const elara = (await engine.listCharacters()).find((c) => c.name.includes("Elara"))!;
    const view = await engine.openCharacter(elara.id);
    expect(view.messages[0]?.role).toBe("assistant");

    let streamed = "";
    const res = await engine.send(
      view.conversation.id,
      "I came back. I take my tea black, by the way.",
      [],
      { onToken: (_d, full) => (streamed = full) },
    );
    expect(res.assistant.content.length).toBeGreaterThan(0);
    expect(streamed.length).toBeGreaterThan(0);

    const thread = await engine.getThread(view.conversation.id);
    expect(thread.some((m) => m.role === "user")).toBe(true);
    expect(thread.some((m) => m.role === "assistant" && m.content === res.assistant.content)).toBe(true);
  }, 120_000);

  it("produces embeddings for semantic recall", async () => {
    const emb = await engine.embed("the dragon on the cornice across the street");
    expect(emb).not.toBeNull();
    expect((emb ?? []).length).toBeGreaterThan(100);
  }, 60_000);

  it("summarizes a transcript into memory candidates", async () => {
    const { summarizeRollup } = await import("../memory");
    const msgs = [
      makeMessage({ role: "user", content: "My sister is getting married in autumn." }),
      makeMessage({ role: "assistant", content: "That's wonderful — autumn weddings are the loveliest." }),
    ];
    const { summary } = await summarizeRollup(engine.ollama, "gemma4:e4b", msgs, "Elara", "Tester");
    expect(summary?.content.length ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
