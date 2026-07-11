/* Live group-room integration against a running Ollama. Opt-in:
     DH_LIVE=1 npx vitest run roomLive
   Exercises the real room loop: create room → judge picks a speaker
   (schema-constrained) → two speaker turns with per-character context →
   deferred maintenance (affect + tagged rollup) → room-born memory
   visible in the 1:1 bond. Uses the fast variant to keep it quick. */
import { describe, it, expect, beforeAll } from "vitest";
import { Engine } from "../index";
import type { OllamaTransport } from "../ports";
import type { OllamaChatRequest, OllamaChatChunk } from "../types";
import { tryCreateNodeDb } from "./nodeDb";

const LIVE = process.env.DH_LIVE === "1";
const MODEL = process.env.DH_LIVE_MODEL || "gemma4:e4b";

class FetchOllama implements OllamaTransport {
  constructor(private readonly base = "http://localhost:11434") {}
  async chatStream(
    req: OllamaChatRequest,
    onChunk: (c: OllamaChatChunk) => void,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    const res = await fetch(`${this.base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...req, stream: true }),
      ...(opts?.signal ? { signal: opts.signal } : {}),
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

describe.skipIf(!LIVE)("live group room ↔ ollama", () => {
  let engine: Engine;
  let roomId: string;
  let elaraId: string;
  let jaxId: string;

  beforeAll(async () => {
    engine = await Engine.create(tryCreateNodeDb()!, new FetchOllama());
    await engine.updateSettings({
      defaultModel: MODEL,
      fastModel: MODEL,
      numCtx: 8192,
      semanticRecall: true,
      embeddingModel: "nomic-embed-text",
    });
    await engine.setUserName("Robin");
    await engine.markOnboarded();
    await engine.seedStartersIfEmpty();
    const chars = await engine.listCharacters();
    elaraId = chars.find((c) => c.name.includes("Elara"))!.id;
    jaxId = chars.find((c) => c.name.includes("Jax"))!.id;
    const room = await engine.createRoom("The Hearth", [elaraId, jaxId]);
    roomId = room.conversation.id;
  }, 60_000);

  it("the judge picks a valid participant via schema-constrained output", async () => {
    const room = await engine.openRoom(roomId);
    const judge = engine.createRoomJudge(
      room.participants.map((p) => ({
        id: p.character.id,
        name: p.character.name,
        epithet: p.character.epithet,
      })),
    );
    const picked = await judge.firstSpeaker("I brought fresh bread for everyone.", []);
    expect([elaraId, jaxId]).toContain(picked);
  }, 120_000);

  it("two characters answer in their own voices, labeled and attributed", async () => {
    await engine.postUserMessage(roomId, "Evening, you two. The storm kept me up all night.");
    const first = await engine.generateCharacterTurn(roomId, elaraId, { deferMaintenance: true });
    expect(first.message.content.length).toBeGreaterThan(0);
    expect(first.message.speakerCharacterId).toBe(elaraId);

    const second = await engine.generateCharacterTurn(roomId, jaxId, { deferMaintenance: true });
    expect(second.message.content.length).toBeGreaterThan(0);
    expect(second.message.speakerCharacterId).toBe(jaxId);
    // the sanitizer keeps a speaker from writing the others' lines
    expect(second.message.content).not.toMatch(/^Elara Vance\s*:/m);
    expect(second.message.content).not.toMatch(/^Robin\s*:/m);
  }, 240_000);

  it("maintenance writes affect and a tagged rollup that reaches the 1:1 bond", async () => {
    await engine.updateSettings({ rollupThresholdTokens: 1, recentVerbatimTurns: 1 });
    await engine.runRoomMaintenance(roomId, [elaraId, jaxId]);

    const room = await engine.openRoom(roomId);
    const elara = room.participants.find((p) => p.character.id === elaraId)!;
    expect(elara.relationship.affect ?? "").not.toBe("");

    // the room summary is room-scoped
    const summary = await engine.repos.latestRoomSummary(roomId);
    expect(summary?.content.length ?? 0).toBeGreaterThan(0);

    // the folded slice is marked summarized
    const thread = await engine.getThread(roomId);
    expect(thread.some((m) => m.summarized)).toBe(true);
  }, 240_000);
});
