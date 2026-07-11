/* Engine room API end-to-end against in-memory sqlite + a scripted Ollama
   transport (no live server). Covers the speaker turn, model pinning, tagged
   rollup fan-out, affect, aborts, and room-born memories recalled in 1:1. */
import { describe, it, expect, beforeEach } from "vitest";
import { Engine, TurnAbortedError } from "../index";
import type { OllamaTransport } from "../ports";
import type { OllamaChatChunk, OllamaChatRequest } from "../types";
import { makeSoul } from "./fixtures";
import { hasNodeSqlite, tryCreateNodeDb } from "./nodeDb";

/** Replays one canned reply per chat call, capturing every request. */
class ScriptedTransport implements OllamaTransport {
  requests: OllamaChatRequest[] = [];
  private script: Array<string | ((req: OllamaChatRequest) => OllamaChatChunk[])> = [];

  push(reply: string | object): void {
    this.script.push(typeof reply === "string" ? reply : JSON.stringify(reply));
  }
  pushChunks(fn: (req: OllamaChatRequest) => OllamaChatChunk[]): void {
    this.script.push(fn);
  }

  async chatStream(
    req: OllamaChatRequest,
    onChunk: (c: OllamaChatChunk) => void,
  ): Promise<void> {
    this.requests.push(req);
    const next = this.script.shift();
    if (next === undefined) throw new Error("ScriptedTransport: no reply scripted");
    if (typeof next === "function") {
      for (const c of next(req)) onChunk(c);
      return;
    }
    onChunk({ message: { role: "assistant", content: next }, done: true, eval_count: 5 });
  }
  async post<T>(): Promise<T> {
    throw new Error("no embeddings in tests");
  }
  async get<T>(): Promise<T> {
    throw new Error("offline");
  }
}

async function createEngine(transport: ScriptedTransport): Promise<Engine> {
  const engine = await Engine.create(tryCreateNodeDb()!, transport);
  await engine.setUserName("Robin");
  return engine;
}

async function twoCharacterRoom(engine: Engine) {
  const elara = await engine.createCharacter({
    name: "Elara Vance",
    epithet: "Keeper of the lighthouse",
    soul: makeSoul(),
    defaultModel: "some-per-character-model",
  });
  const jax = await engine.createCharacter({
    name: "Jax Sterling",
    epithet: "Wandering tinker",
    soul: makeSoul({ coreIdentity: "A tinker who fixes what others abandon." }),
  });
  const room = await engine.createRoom("The Hearth", [elara.id, jax.id]);
  return { elara, jax, room };
}

describe.skipIf(!hasNodeSqlite())("engine rooms", () => {
  let transport: ScriptedTransport;
  let engine: Engine;

  beforeEach(async () => {
    transport = new ScriptedTransport();
    engine = await createEngine(transport);
  });

  it("creates a room with bonds for every participant and no greeting", async () => {
    const { room } = await twoCharacterRoom(engine);
    expect(room.conversation.kind).toBe("room");
    expect(room.participants).toHaveLength(2);
    expect(room.participants.every((p) => p.relationship.id)).toBe(true);
    expect(room.messages).toHaveLength(0);
    expect((await engine.listRooms()).map((r) => r.id)).toEqual([room.conversation.id]);
  });

  it("generates a speaker turn with that character's context, pinned to the app model", async () => {
    const { elara, jax, room } = await twoCharacterRoom(engine);
    await engine.postUserMessage(room.conversation.id, "Elara, how is the lamp?");
    transport.push("Elara Vance: Steady as ever.\nJax Sterling: I could oil the bearings.");

    let streamed = "";
    const res = await engine.generateCharacterTurn(room.conversation.id, elara.id, {
      onToken: (_d, full) => (streamed = full),
      deferMaintenance: true,
    });

    // sanitized: self-label stripped, Jax's stolen line truncated
    expect(res.message.content).toBe("Steady as ever.");
    expect(res.message.speakerCharacterId).toBe(elara.id);
    expect(streamed.length).toBeGreaterThan(0);

    const req = transport.requests[0]!;
    // pinned to the shared app model, not the character's own override
    expect(req.model).toBe(engine.getSettings().defaultModel);
    expect(req.options?.num_ctx).toBe(engine.getSettings().numCtx);
    const system = req.messages[0]!.content;
    expect(system).toContain("<room>");
    expect(system).toContain("Jax Sterling — Wandering tinker");
    expect(system).toContain("You are Elara Vance and only Elara Vance.");
    // the user's message arrives as labeled history, not as a bare user turn
    const last = req.messages[req.messages.length - 1]!;
    expect(last.content).toContain("Robin: Elara, how is the lamp?");
    void jax;
  });

  it("labels prior speakers in the next speaker's history", async () => {
    const { elara, jax, room } = await twoCharacterRoom(engine);
    await engine.postUserMessage(room.conversation.id, "Evening, you two.");
    transport.push("The lamp is lit.");
    await engine.generateCharacterTurn(room.conversation.id, elara.id, { deferMaintenance: true });

    transport.push("Cold night for it.");
    await engine.generateCharacterTurn(room.conversation.id, jax.id, { deferMaintenance: true });

    const req = transport.requests[1]!;
    const text = req.messages.map((m) => `${m.role}|${m.content}`).join("\n");
    expect(text).toContain("Elara Vance: The lamp is lit.");
    // Jax's own system prompt speaks as Jax
    expect(req.messages[0]!.content).toContain("You are Jax Sterling and only Jax Sterling.");
  });

  it("throws TurnAbortedError on cancel and persists nothing", async () => {
    const { elara, room } = await twoCharacterRoom(engine);
    await engine.postUserMessage(room.conversation.id, "Anyone?");
    transport.pushChunks(() => [
      { message: { role: "assistant", content: "Half a thought—" }, done: false },
      { done: true, done_reason: "cancel" },
    ]);

    await expect(
      engine.generateCharacterTurn(room.conversation.id, elara.id, { deferMaintenance: true }),
    ).rejects.toBeInstanceOf(TurnAbortedError);

    const thread = await engine.getThread(room.conversation.id);
    expect(thread.filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  it("refuses a speaker who is not present", async () => {
    const { elara, room } = await twoCharacterRoom(engine);
    await engine.removeRoomParticipant(room.conversation.id, elara.id);
    await expect(
      engine.generateCharacterTurn(room.conversation.id, elara.id, { deferMaintenance: true }),
    ).rejects.toThrow(/not present/);
  });

  it("runs maintenance: affect for the speakers, tagged rollup fanned out per bond", async () => {
    const { elara, jax, room } = await twoCharacterRoom(engine);
    // tiny thresholds so the rollup fires on a short transcript
    await engine.updateSettings({ rollupThresholdTokens: 1, recentVerbatimTurns: 1 });

    await engine.postUserMessage(room.conversation.id, "I dread the storm tonight.");
    transport.push("Stay by the fire, then.");
    await engine.generateCharacterTurn(room.conversation.id, elara.id, { deferMaintenance: true });

    // maintenance: one affect call (Elara spoke), then the rollup pass
    transport.push("I feel protective of Robin tonight.");
    transport.push({
      summary: "A stormy night at the hearth; Robin was afraid and Elara comforted them.",
      facts: [
        {
          content: "Robin dreads storms.",
          kind: "fact",
          keys: ["storm"],
          salience: 0.7,
          retainedBy: ["Elara Vance", "Jax Sterling"],
        },
        {
          content: "Elara promised Robin the fire would stay lit.",
          kind: "tender",
          keys: ["fire", "promise"],
          salience: 0.6,
          retainedBy: ["Elara Vance"],
        },
      ],
    });
    await engine.runRoomMaintenance(room.conversation.id, [elara.id]);

    // affect went to Elara's bond and mentions the room in its instruction
    const affectReq = transport.requests[1]!;
    expect(affectReq.messages[0]!.content).toContain('"The Hearth"');
    expect(affectReq.messages[1]!.content).toContain("Robin: I dread the storm tonight.");
    const elaraRoom = (await engine.openRoom(room.conversation.id)).participants.find(
      (p) => p.character.id === elara.id,
    )!;
    expect(elaraRoom.relationship.affect).toContain("protective");

    // rollup request used the schema format on the shared model
    const rollupReq = transport.requests[2]!;
    expect(rollupReq.model).toBe(engine.getSettings().defaultModel);
    expect((rollupReq.format as Record<string, unknown>)?.type).toBe("object");

    // fan-out: shared fact in both bonds, tender one only in Elara's
    const elaraMems = await engine.listMemories(elaraRoom.relationship.id);
    const jaxRel = (await engine.openRoom(room.conversation.id)).participants.find(
      (p) => p.character.id === jax.id,
    )!.relationship;
    const jaxMems = await engine.listMemories(jaxRel.id);
    expect(elaraMems.map((m) => m.content).sort()).toEqual([
      "Elara promised Robin the fire would stay lit.",
      "Robin dreads storms.",
    ]);
    expect(jaxMems.map((m) => m.content)).toEqual(["Robin dreads storms."]);
    expect(elaraMems.every((m) => m.roomId === room.conversation.id)).toBe(true);

    // the room summary is room-scoped, not in any bond
    const summary = await engine.repos.latestRoomSummary(room.conversation.id);
    expect(summary?.content).toContain("stormy night");
    expect(summary?.relationshipId).toBeNull();

    // and a later 1:1 with Elara recalls the room-born fact
    const view = await engine.openCharacter(elara.id);
    transport.push("You mentioned dreading storms, once.");
    const sendRes = await engine.send(view.conversation.id, "That storm is back.");
    expect(
      sendRes.diagnostics.recalledMemories.some((m) => m.content === "Robin dreads storms."),
    ).toBe(true);
  });
});
