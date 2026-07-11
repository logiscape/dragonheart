/* RoomSession — the effect interpreter — with a fake scheduler, fake
   visibility, and a fake engine, so timers and streams are fully scripted. */
import { describe, it, expect } from "vitest";
import { RoomSession, type Scheduler, type Visibility } from "../roomSession";
import { TurnAbortedError } from "@engine/index";
import type {
  CascadeConfig,
  Engine,
  Message,
  RoomPhase,
  RoomView,
  RoomJudge,
} from "@engine/index";
import {
  makeCharacter,
  makeMessage,
  makeRelationship,
  makeRoomConversation,
} from "../../engine/__tests__/fixtures";

const CFG: CascadeConfig = {
  followUpBase: 0.6,
  followUpDecay: 0.5,
  maxFollowUps: 3,
  idleMs: 120_000,
  idleCapMessages: 4,
  beatRangeMs: [500, 500],
};

function fakeScheduler() {
  let nextId = 1;
  const tasks = new Map<number, { fn: () => void; ms: number }>();
  const scheduler: Scheduler = {
    set(fn, ms) {
      tasks.set(nextId, { fn, ms });
      return nextId++;
    },
    clear(id) {
      tasks.delete(id);
    },
  };
  const fire = (id: number) => {
    const t = tasks.get(id);
    tasks.delete(id);
    t?.fn();
  };
  const pending = () => [...tasks.entries()].map(([id, t]) => ({ id, ms: t.ms }));
  return { scheduler, fire, pending };
}

function fakeVisibility(initial = true) {
  let visible = initial;
  const subs = new Set<(v: boolean) => void>();
  const visibility: Visibility = {
    isVisible: () => visible,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  return {
    visibility,
    setVisible(v: boolean) {
      visible = v;
      for (const cb of subs) cb(v);
    },
  };
}

interface Deferred {
  resolve(content: string): void;
  reject(e: unknown): void;
  speakerId: string;
  signal: AbortSignal | undefined;
}

function fakeEngine(judge: RoomJudge) {
  const turns: Deferred[] = [];
  const maintenance: string[][] = [];
  let msgCount = 0;
  const engine = {
    getUser: () => ({ id: "user-1", displayName: "Robin", defaultPersonaId: "p", createdAt: 0 }),
    createRoomJudge: () => judge,
    async postUserMessage(conversationId: string, content: string): Promise<Message> {
      return makeMessage({ id: `u-${++msgCount}`, conversationId, role: "user", content });
    },
    generateCharacterTurn(
      conversationId: string,
      characterId: string,
      opts: { signal?: AbortSignal } = {},
    ) {
      return new Promise((resolve, reject) => {
        turns.push({
          speakerId: characterId,
          signal: opts.signal,
          resolve: (content: string) =>
            resolve({
              message: makeMessage({
                id: `c-${++msgCount}`,
                conversationId,
                role: "assistant",
                content,
                speakerCharacterId: characterId,
              }),
              thinking: "",
              diagnostics: { recalledMemories: [], triggeredLore: [], budget: {} },
            }),
          reject,
        });
        opts.signal?.addEventListener("abort", () => reject(new TurnAbortedError()), { once: true });
      });
    },
    async runRoomMaintenance(_conversationId: string, spoke: string[]) {
      maintenance.push(spoke);
    },
  };
  return { engine: engine as unknown as Engine, turns, maintenance };
}

const ELARA = makeCharacter({ id: "elara", name: "Elara Vance" });
const JAX = makeCharacter({ id: "jax", name: "Jax Sterling" });

function roomView(): RoomView {
  return {
    conversation: makeRoomConversation(),
    participants: [ELARA, JAX].map((character) => ({
      character,
      relationship: makeRelationship({ id: `rel-${character.id}`, characterId: character.id }),
      joinedAt: 0,
      leftAt: null,
      talkativeness: 0.5,
    })),
    messages: [],
  };
}

function judgeAlways(id: string | null): RoomJudge {
  return {
    firstSpeaker: async () => id,
    followUpSpeaker: async () => null,
    idleSpeaker: async () => id,
  };
}

function harness(judge: RoomJudge, rng: () => number = () => 0.99) {
  const sched = fakeScheduler();
  const vis = fakeVisibility();
  const eng = fakeEngine(judge);
  const phases: RoomPhase[] = [];
  const appended: Message[] = [];
  const streaming: Array<{ id: string | null; text: string }> = [];
  const session = new RoomSession(roomView(), CFG, {
    engine: eng.engine,
    scheduler: sched.scheduler,
    visibility: vis.visibility,
    rng,
    callbacks: {
      onPhase: (p) => phases.push(p),
      onMessage: (m) => appended.push(m),
      onStreaming: (id, text) => streaming.push({ id, text }),
      onError: () => {},
    },
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { session, sched, vis, eng, phases, appended, streaming, settle };
}

describe("RoomSession", () => {
  it("arms the idle timer on open, gated by visibility", async () => {
    const h = harness(judgeAlways("jax"));
    expect(h.sched.pending()).toEqual([{ id: 1, ms: 120_000 }]);

    h.vis.setVisible(false);
    expect(h.sched.pending()).toEqual([]);
    h.vis.setVisible(true);
    expect(h.sched.pending()).toEqual([{ id: 2, ms: 120_000 }]);
    h.session.dispose();
  });

  it("user post → beat → turn → reply appended → idle re-armed; maintenance flushed", async () => {
    const h = harness(judgeAlways("jax"), () => 0.99); // follow-up roll always fails
    await h.session.postUserMessage("evening you two");
    await h.settle();

    // idle disarmed, beat pending; the typing indicator points at Jax
    const beats = h.sched.pending().filter((t) => t.ms === 500);
    expect(beats).toHaveLength(1);
    expect(h.streaming.at(-1)).toEqual({ id: "jax", text: "" });

    h.sched.fire(beats[0]!.id);
    await h.settle();
    expect(h.eng.turns).toHaveLength(1);
    h.eng.turns[0]!.resolve("Cold night for it.");
    await h.settle();

    expect(h.appended.map((m) => m.content)).toEqual(["evening you two", "Cold night for it."]);
    expect(h.streaming.at(-1)).toEqual({ id: null, text: "" });
    expect(h.phases.at(-1)).toBe("idle");
    // idle timer re-armed, deferred maintenance ran for the speaker
    expect(h.sched.pending().some((t) => t.ms === 120_000)).toBe(true);
    expect(h.eng.maintenance).toEqual([["jax"]]);
    h.session.dispose();
  });

  it("a user post during the beat cancels the queued turn client-side", async () => {
    const h = harness(judgeAlways("jax"));
    await h.session.postUserMessage("first");
    await h.settle();
    const firstBeat = h.sched.pending().find((t) => t.ms === 500)!;

    await h.session.postUserMessage("second, actually");
    await h.settle();
    // the first beat was cleared; only the new one remains
    const beats = h.sched.pending().filter((t) => t.ms === 500);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.id).not.toBe(firstBeat.id);

    h.sched.fire(beats[0]!.id);
    await h.settle();
    expect(h.eng.turns).toHaveLength(1); // never generated for the stale post
    h.session.dispose();
  });

  it("a user post mid-generation aborts the stream; the aborted turn persists nothing", async () => {
    const h = harness(judgeAlways("jax"));
    await h.session.postUserMessage("first");
    await h.settle();
    h.sched.fire(h.sched.pending().find((t) => t.ms === 500)!.id);
    await h.settle();
    expect(h.eng.turns).toHaveLength(1);

    await h.session.postUserMessage("wait—");
    await h.settle();
    expect(h.eng.turns[0]!.signal?.aborted).toBe(true);

    // the new cascade proceeds for the second post
    h.sched.fire(h.sched.pending().find((t) => t.ms === 500)!.id);
    await h.settle();
    expect(h.eng.turns).toHaveLength(2);
    h.eng.turns[1]!.resolve("Here now.");
    await h.settle();
    expect(h.appended.map((m) => m.content)).toEqual(["first", "wait—", "Here now."]);
    h.session.dispose();
  });

  it("idle firing stirs a character", async () => {
    const h = harness(judgeAlways("elara"));
    const idle = h.sched.pending().find((t) => t.ms === 120_000)!;
    h.sched.fire(idle.id);
    await h.settle();
    h.sched.fire(h.sched.pending().find((t) => t.ms === 500)!.id);
    await h.settle();
    expect(h.eng.turns[0]!.speakerId).toBe("elara");
    h.session.dispose();
  });

  it("dispose clears timers, aborts the stream, and is idempotent", async () => {
    const h = harness(judgeAlways("jax"));
    await h.session.postUserMessage("hello");
    await h.settle();
    h.sched.fire(h.sched.pending().find((t) => t.ms === 500)!.id);
    await h.settle();

    h.session.dispose();
    h.session.dispose();
    expect(h.eng.turns[0]!.signal?.aborted).toBe(true);
    expect(h.sched.pending()).toEqual([]);

    // a disposed session ignores further posts
    await h.session.postUserMessage("anyone?");
    await h.settle();
    expect(h.appended.map((m) => m.content)).toEqual(["hello"]);
  });
});
