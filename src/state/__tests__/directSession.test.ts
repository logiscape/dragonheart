import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppStore } from "../store";
import { Engine } from "@engine/index";
import type { ChatStreamOptions, OllamaTransport } from "@engine/ports";
import type { OllamaChatChunk, OllamaChatRequest } from "@engine/types";
import { hasNodeSqlite, tryCreateNodeDb } from "@engine/__tests__/nodeDb";
import { makeSoul } from "@engine/__tests__/fixtures";

class ControlledTransport implements OllamaTransport {
  ignoreAbort = false;
  calls: Array<{ req: OllamaChatRequest; token: (text: string) => void; finish: (text: string) => void; fail: () => void; signal?: AbortSignal }> = [];
  setBaseUrl() {}
  async chatStream(req: OllamaChatRequest, onChunk: (chunk: OllamaChatChunk) => void, opts?: ChatStreamOptions) {
    if (!req.stream) { onChunk({ message: { role: "assistant", content: "Warm." }, done: true }); return; }
    await new Promise<void>((resolve, reject) => {
      const token = (content: string) => onChunk({ message: { role: "assistant", content }, done: false });
      this.calls.push({ req, token, finish: (text) => { token(text); resolve(); },
        fail: () => reject(new Error("Ollama unavailable")), signal: opts?.signal });
      if (!this.ignoreAbort) opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }
  async get<T>(): Promise<T> { throw new Error("offline"); }
  async post<T>(): Promise<T> { throw new Error("unused"); }
}

describe.skipIf(!hasNodeSqlite())("direct conversation lifecycle", () => {
  let engine: Engine;
  let store: AppStore;
  let transport: ControlledTransport;
  let a: string;
  let b: string;
  beforeEach(async () => {
    transport = new ControlledTransport();
    engine = await Engine.create(tryCreateNodeDb()!, transport);
    await engine.updateSettings({ semanticRecall: false, rollupThresholdTokens: 100000 });
    a = (await engine.createCharacter({ name: "A", soul: makeSoul() })).id;
    b = (await engine.createCharacter({ name: "B", soul: makeSoul() })).id;
    store = new AppStore(engine, transport);
    await store.refreshCharacters();
    await store.openCharacter(a);
  });
  const waitForCall = async (transport: ControlledTransport, count = 1) => {
    await vi.waitFor(() => expect(transport.calls).toHaveLength(count));
    return transport.calls[count - 1]!;
  };

  it("keeps A's late tokens and reply out of B's conversation", async () => {
    const aConversation = store.getState().conversation!.id;
    const sent = store.sendMessage("For A");
    const call = await waitForCall(transport);
    await store.openCharacter(b);
    call.token("A partial");
    expect(store.getState().streamingText).toBe("");
    call.finish(" reply");
    await sent;
    expect(store.getState().messages).toEqual([]);
    expect((await engine.getThread(aConversation)).map((m) => m.content)).toEqual(["For A", "A partial reply"]);
  });

  it("does not let an old completion clear a newer stream", async () => {
    const first = store.sendMessage("A");
    const old = await waitForCall(transport);
    await store.openCharacter(b);
    const second = store.sendMessage("B");
    const current = await waitForCall(transport, 2);
    old.finish("Old reply"); await first;
    expect(store.getState().streaming).toBe(true);
    current.finish("B reply"); await second;
    expect(store.getState().messages.map((m) => m.content)).toEqual(["B", "B reply"]);
  });

  it("keeps a new evening isolated and reconnects to a background stream", async () => {
    const sent = store.sendMessage("Earlier");
    const call = await waitForCall(transport);
    await store.openCharacter(b);
    call.token("Still ");
    await store.openCharacter(a);
    expect(store.getState().streamingText).toBe("Still ");
    await store.newConversation();
    call.finish("here"); await sent;
    expect(store.getState().messages).toEqual([]);
    expect(store.getState().streaming).toBe(false);
  });

  it("keeps failed text and attachments, then edits and retries the same row", async () => {
    const attachments = [{ kind: "image" as const, mime: "image/png", data: "aGVsbG8=" }];
    const sent = store.sendMessage("Original", attachments);
    (await waitForCall(transport)).fail(); await sent;
    const failed = store.getState().failedSend!;
    expect(failed.message.attachments).toEqual(attachments);
    expect(store.getState().messages).toHaveLength(1);
    const retried = store.retryMessage("Edited");
    const call = await waitForCall(transport, 2);
    expect(call.req.messages.filter((m) => m.content.includes("Edited"))).toHaveLength(1);
    expect(call.req.messages.some((m) => m.content === "Original")).toBe(false);
    call.finish("Understood"); await retried;
    const messages = await engine.getThread(failed.message.conversationId);
    expect(messages.map((m) => m.content)).toEqual(["Edited", "Understood"]);
    expect(messages[0]!.id).toBe(failed.message.id);
    expect(messages[0]!.attachments).toEqual(attachments);
    expect(store.getState().failedSend).toBeNull();
  });

  it("recovers an unanswered persisted message after reopening the app store", async () => {
    const sent = store.sendMessage("Keep me");
    (await waitForCall(transport)).fail(); await sent;
    const reopened = new AppStore(engine, transport);
    await reopened.openCharacter(a);
    expect(reopened.getState().failedSend?.message.content).toBe("Keep me");
    const retried = reopened.retryMessage();
    (await waitForCall(transport, 2)).finish("Here"); await retried;
    expect(reopened.getState().messages).toHaveLength(2);
  });

  it("keeps background failures out of the current conversation and restores them on return", async () => {
    const sent = store.sendMessage("For A");
    const call = await waitForCall(transport);
    await store.openCharacter(b);
    call.fail(); await sent;
    expect(store.getState().failedSend).toBeNull();
    await store.openCharacter(a);
    expect(store.getState().failedSend?.message.content).toBe("For A");
  });

  it("retains a message even if its first database write fails", async () => {
    const write = vi.spyOn(engine.repos, "addMessage").mockRejectedValueOnce(new Error("Disk full"));
    await store.sendMessage("Do not lose this");
    expect(store.getState().failedSend?.message.content).toBe("Do not lose this");
    expect(await engine.getThread(store.getState().conversation!.id)).toHaveLength(0);
    write.mockRestore();
    const retry = store.retryMessage();
    (await waitForCall(transport)).finish("Kept"); await retry;
    expect(await engine.getThread(store.getState().conversation!.id)).toHaveLength(2);
  });

  it("refreshes a stale load when the background reply finishes during navigation", async () => {
    const sent = store.sendMessage("For A");
    const call = await waitForCall(transport);
    await store.openCharacter(b);
    const original = engine.openCharacter.bind(engine);
    vi.spyOn(engine, "openCharacter").mockImplementation(async (id) => {
      const snapshot = await original(id);
      call.finish("Finished during load");
      await sent;
      return snapshot;
    });
    await store.openCharacter(a);
    expect(store.getState().failedSend).toBeNull();
    expect(store.getState().messages.map((m) => m.content)).toEqual(["For A", "Finished during load"]);
  });

  it("does not duplicate a persisted reply loaded before its send promise settles", async () => {
    const original = engine.send.bind(engine);
    let release!: () => void;
    vi.spyOn(engine, "send").mockImplementation(async (...args) => {
      const result = await original(...args);
      await new Promise<void>((resolve) => { release = resolve; });
      return result;
    });
    const sent = store.sendMessage("For A");
    (await waitForCall(transport)).finish("Persisted reply");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await store.openCharacter(b);
    await store.openCharacter(a);
    release(); await sent;
    expect(store.getState().messages.map((m) => m.content)).toEqual(["For A", "Persisted reply"]);
  });

  it("stops a partial reply without persisting it and allows retry", async () => {
    transport.ignoreAbort = true;
    const sent = store.sendMessage("Wait");
    const call = await waitForCall(transport);
    call.token("Partial"); store.stopReply(); await sent;
    expect(call.signal?.aborted).toBe(true);
    expect(store.getState().failedSend?.error).toContain("Reply stopped");
    expect(await engine.getThread(store.getState().conversation!.id)).toHaveLength(1);
    const retried = store.retryMessage();
    // Even a transport that completes after cancellation cannot write a reply.
    call.finish("Late output");
    (await waitForCall(transport, 2)).finish("Complete"); await retried;
    expect(store.getState().messages.map((m) => m.content)).toEqual(["Wait", "Complete"]);
  });

  it("ignores a stale navigation result", async () => {
    const original = engine.openCharacter.bind(engine);
    let release!: () => void;
    vi.spyOn(engine, "openCharacter").mockImplementation(async (id) => {
      if (id === a) await new Promise<void>((r) => { release = r; });
      return original(id);
    });
    const slow = store.openCharacter(a);
    await store.openCharacter(b);
    release(); await slow;
    expect(store.getState().currentCharacterId).toBe(b);
  });
});
