import { beforeEach, describe, expect, it, vi } from "vitest";
import { Engine } from "../index";
import type { OllamaTransport } from "../ports";
import { hasNodeSqlite, tryCreateNodeDb } from "./nodeDb";
import { makeSoul } from "./fixtures";

const transport: OllamaTransport = {
  async chatStream(_request, chunk) {
    chunk({ message: { role: "assistant", content: "Here with you." }, done: true });
  },
  async get<T>(): Promise<T> { throw new Error("unused"); },
  async post<T>(): Promise<T> { throw new Error("unused"); },
};

describe.skipIf(!hasNodeSqlite())("targeted send lookups", () => {
  let engine: Engine;
  let conversationId: string;
  beforeEach(async () => {
    // Equal timestamps exercise the same rowid tie-breaker as listMessages.
    engine = await Engine.create(tryCreateNodeDb()!, transport, { now: () => 1000 });
    await engine.updateSettings({ semanticRecall: false, rollupThresholdTokens: 100000 });
    const character = await engine.createCharacter({ name: "A", soul: makeSoul() });
    conversationId = (await engine.openCharacter(character.id)).conversation.id;
  });

  it.each([undefined, "new-message-id"])("does not load the full thread for a fresh send (%s)", async (userMessageId) => {
    const fullThread = vi.spyOn(engine.repos, "listMessages").mockRejectedValue(new Error("Full history must not be loaded"));
    const latest = vi.spyOn(engine.repos, "latestMessageId");
    const lookup = vi.spyOn(engine.repos, "getMessage");
    const result = await engine.send(conversationId, "Hello", [], { userMessageId });
    expect(result.assistant.content).toBe("Here with you.");
    expect(fullThread).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();
    expect(lookup).toHaveBeenCalledTimes(userMessageId ? 1 : 0);
  });

  it("retries only the latest user message, even when timestamps tie", async () => {
    const earlier = await engine.repos.addMessage({ conversationId, role: "user", content: "Earlier",
      attachments: [], tokens: 1, summarized: false });
    const latest = await engine.repos.addMessage({ conversationId, role: "user", content: "Latest",
      attachments: [], tokens: 1, summarized: false });
    const fullThread = vi.spyOn(engine.repos, "listMessages").mockRejectedValue(new Error("Full history must not be loaded"));
    await expect(engine.send(conversationId, "Changed", [], { userMessageId: earlier.id })).rejects.toThrow("latest unanswered");
    const result = await engine.send(conversationId, "Edited", [], { userMessageId: latest.id });
    expect(result.user.id).toBe(latest.id);
    expect((await engine.repos.getMessage(earlier.id))!.content).toBe("Earlier");
    expect((await engine.repos.getMessage(latest.id))!.content).toBe("Edited");
    expect(fullThread).not.toHaveBeenCalled();
    await expect(engine.send(conversationId, "Again", [], { userMessageId: latest.id })).rejects.toThrow("latest unanswered");
    await expect(engine.send(conversationId, "Wrong role", [], { userMessageId: result.assistant.id })).rejects.toThrow("latest unanswered");
  });

  it("rejects a retry ID belonging to another conversation without changing either thread", async () => {
    const foreign = await engine.repos.addMessage({ conversationId, role: "user", content: "Keep me",
      attachments: [], tokens: 1, summarized: false });
    const character = await engine.createCharacter({ name: "B", soul: makeSoul() });
    const other = await engine.openCharacter(character.id);
    await expect(engine.send(other.conversation.id, "Overwrite", [], { userMessageId: foreign.id })).rejects.toThrow("latest unanswered");
    expect((await engine.repos.getMessage(foreign.id))!.content).toBe("Keep me");
    expect(await engine.getThread(other.conversation.id)).toEqual([]);
  });
});
