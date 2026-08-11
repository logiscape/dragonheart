/* The "Underlying mind" fix: characters carry no baked-in model, so 1:1 turns
   follow settings.defaultModel — and switching it mid-conversation takes
   effect on the very next send. Explicit per-character overrides still win. */
import { describe, it, expect, beforeEach } from "vitest";
import { Engine } from "../index";
import type { OllamaTransport } from "../ports";
import type { OllamaChatChunk, OllamaChatRequest } from "../types";
import { makeSoul } from "./fixtures";
import { hasNodeSqlite, tryCreateNodeDb } from "./nodeDb";

/** Replays one canned reply per chat call, capturing every request. */
class ScriptedTransport implements OllamaTransport {
  requests: OllamaChatRequest[] = [];
  private script: string[] = [];

  push(reply: string): void {
    this.script.push(reply);
  }

  async chatStream(
    req: OllamaChatRequest,
    onChunk: (c: OllamaChatChunk) => void,
  ): Promise<void> {
    this.requests.push(req);
    const next = this.script.shift();
    if (next === undefined) throw new Error("ScriptedTransport: no reply scripted");
    onChunk({ message: { role: "assistant", content: next }, done: true, eval_count: 5 });
  }
  async post<T>(): Promise<T> {
    throw new Error("no embeddings in tests");
  }
  async get<T>(): Promise<T> {
    throw new Error("offline");
  }
}

/** Let the void'd background affect/rollup calls settle between sends. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Speaker turns stream; background affect/rollup calls don't. */
const chatRequests = (t: ScriptedTransport) => t.requests.filter((r) => r.stream);

describe.skipIf(!hasNodeSqlite())("model switching in 1:1", () => {
  let transport: ScriptedTransport;
  let engine: Engine;

  beforeEach(async () => {
    transport = new ScriptedTransport();
    engine = await Engine.create(tryCreateNodeDb()!, transport);
    await engine.setUserName("Robin");
  });

  it("a character without overrides follows settings.defaultModel, including mid-conversation switches", async () => {
    const elara = await engine.createCharacter({ name: "Elara Vance", soul: makeSoul() });
    expect(elara.defaultModel).toBeNull();
    expect(elara.fastModel).toBeNull();
    const view = await engine.openCharacter(elara.id);

    transport.push("The lamp is steady."); // reply
    transport.push("Warm."); // background affect note
    await engine.send(view.conversation.id, "How is the lamp?");
    await settle();
    expect(chatRequests(transport)[0]!.model).toBe(engine.getSettings().defaultModel);

    // the user picks a new Underlying mind between turns
    await engine.updateSettings({ defaultModel: "gemma4:next" });

    transport.push("Still steady."); // reply
    transport.push("Content."); // background affect note
    await engine.send(view.conversation.id, "And now?");
    await settle();
    expect(chatRequests(transport)[1]!.model).toBe("gemma4:next");
  });

  it("an explicit per-character override still wins over the settings", async () => {
    const jax = await engine.createCharacter({
      name: "Jax Sterling",
      soul: makeSoul(),
      defaultModel: "jax-special-model",
    });
    const view = await engine.openCharacter(jax.id);

    transport.push("Fixed it already.");
    transport.push("Smug.");
    await engine.send(view.conversation.id, "Is the kettle mended?");
    await settle();
    expect(chatRequests(transport)[0]!.model).toBe("jax-special-model");
  });
});
