import { describe, expect, it, vi } from "vitest";
import { Engine } from "../index";
import { Repos, type MemoryInput } from "../db/repositories";
import { OllamaClient } from "../ollama";
import { summarizeRollup, summarizeGroupRollup } from "../memory";
import type { Db, OllamaTransport } from "../ports";
import type { OllamaChatRequest } from "../types";
import { makeMessage, makeSoul } from "./fixtures";
import { hasNodeSqlite, tryCreateNodeDb } from "./nodeDb";

function canned(reply: string) {
  const requests: OllamaChatRequest[] = [];
  const transport: OllamaTransport = {
    async chatStream(req, chunk) {
      requests.push(req);
      chunk({ message: { role: "assistant", content: req.stream ? "A reply" : reply }, done: true });
    },
    async post<T>(): Promise<T> { throw new Error("unused"); },
    async get<T>(): Promise<T> { throw new Error("offline"); },
  };
  return { transport, requests };
}

describe("rollup validation", () => {
  it.each(["not JSON", "{}", '{"summary":12,"facts":[]}', '{"summary":"ok","facts":{}}'])
    ("rejects malformed output in both summarizers: %s", async (reply) => {
      const client = new OllamaClient(canned(reply).transport);
      await expect(summarizeRollup(client, "model", 32768, [makeMessage()], "A", "User")).rejects.toThrow("Invalid memory summary");
      await expect(summarizeGroupRollup(client, "model", 32768, [makeMessage()], [], "User")).rejects.toThrow("Invalid memory summary");
    });
  it("uses the configured context budget for direct rollups", async () => {
    const { transport, requests } = canned('{"summary":"They talked.","facts":[]}');
    await summarizeRollup(new OllamaClient(transport), "model", 32768, [makeMessage()], "A", "User");
    expect(requests[0]!.options?.num_ctx).toBe(32768);
  });
});

describe.skipIf(!hasNodeSqlite())("rollup recovery", () => {
  it.each(["malformed", '{"summary":"","facts":[]}'])
    ("does not retire direct history when extraction fails: %s", async (reply) => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { transport } = canned(reply);
        const engine = await Engine.create(tryCreateNodeDb()!, transport);
        await engine.updateSettings({ semanticRecall: false, rollupThresholdTokens: 0, recentVerbatimTurns: 1 });
        const character = await engine.createCharacter({ name: "A", soul: makeSoul() });
        const view = await engine.openCharacter(character.id);
        await engine.send(view.conversation.id, "Something to keep");
        await vi.waitFor(() => expect(errors).toHaveBeenCalledWith("rollup failed:", expect.any(Error)));
        expect(await engine.repos.listUnsummarized(view.conversation.id)).toHaveLength(2);
        expect((await engine.repos.getConversation(view.conversation.id))!.lastSummaryThroughMessageId).toBeNull();
        expect(await engine.listMemories(view.relationship.id)).toEqual([]);
      } finally { errors.mockRestore(); }
    });

  it.each(["malformed", '{"summary":"","facts":[]}'])
    ("does not retire room history when extraction fails: %s", async (reply) => {
      const engine = await Engine.create(tryCreateNodeDb()!, canned(reply).transport);
      await engine.updateSettings({ semanticRecall: false, rollupThresholdTokens: 0, recentVerbatimTurns: 1 });
      const a = await engine.createCharacter({ name: "A", soul: makeSoul() });
      const b = await engine.createCharacter({ name: "B", soul: makeSoul() });
      const room = await engine.createRoom("Room", [a.id, b.id]);
      await engine.postUserMessage(room.conversation.id, "First");
      await engine.postUserMessage(room.conversation.id, "Second");
      await expect(engine.runRoomMaintenance(room.conversation.id, [])).rejects.toThrow();
      expect(await engine.repos.listUnsummarized(room.conversation.id)).toHaveLength(2);
      expect((await engine.repos.getConversation(room.conversation.id))!.lastSummaryThroughMessageId).toBeNull();
    });

  it.each(["memory", "checkpoint", "cleanup"])("resumes after a %s write failure without duplicate memories, even after restart", async (failure) => {
    const backing = tryCreateNodeDb()!;
    let writes = 0;
    let armed = false;
    const db: Db = {
      select: (sql, params) => backing.select(sql, params),
      async execute(sql, params) {
        const shouldFail = failure === "memory" ? /INSERT INTO memory\s*\(/.test(sql) && ++writes === 2
          : failure === "checkpoint" ? sql.startsWith("UPDATE conversation SET last_summary")
          : sql.startsWith("DELETE FROM memory_rollup");
        if (armed && shouldFail) { armed = false; throw new Error("Disk unavailable"); }
        return backing.execute(sql, params);
      },
    };
    const engine = await Engine.create(db, canned("unused").transport);
    const character = await engine.createCharacter({ name: "A", soul: makeSoul() });
    const view = await engine.openCharacter(character.id);
    const source = await engine.repos.addMessage({ conversationId: view.conversation.id, role: "user",
      content: "Keep this", attachments: [], tokens: 2, summarized: false });
    const memory: MemoryInput = { relationshipId: view.relationship.id, content: "A summary", kind: "summary",
      keys: [], embedding: null, salience: 0.5, sourceMessageIds: [source.id], pinned: false, enabled: true };
    armed = true;
    await expect(engine.repos.saveRollup(view.conversation.id, [source.id], [memory, { ...memory, kind: "fact", content: "A fact" }])).rejects.toThrow("Disk unavailable");
    if (failure === "memory") expect(await engine.repos.listUnsummarized(view.conversation.id)).toHaveLength(1);
    // Simulate reconstruction of the repositories after restarting the app.
    const reopened = new Repos(db, { now: () => 1234 });
    await reopened.updateConversation({ ...view.conversation, sceneState: "A newly edited scene" });
    expect(await reopened.resumeRollup(view.conversation.id)).toBe(true);
    expect(await reopened.listMemories(view.relationship.id)).toHaveLength(2);
    expect(await reopened.listUnsummarized(view.conversation.id)).toEqual([]);
    expect((await reopened.getConversation(view.conversation.id))!.lastSummaryThroughMessageId).toBe(source.id);
    expect((await reopened.getConversation(view.conversation.id))!.sceneState).toBe("A newly edited scene");
    expect(await reopened.resumeRollup(view.conversation.id)).toBe(false);
  });
});
