import { describe, it, expect } from "vitest";
import {
  RoomOrchestrator,
  type CascadeConfig,
  type OrchestratorContext,
  type OrchestratorEffect,
} from "../orchestrator";
import type { RoomJudge, RosterEntry } from "../roomJudge";

const ROSTER: RosterEntry[] = [
  { id: "elara", name: "Elara Vance" },
  { id: "jax", name: "Jax Sterling" },
];

const CFG: CascadeConfig = {
  followUpBase: 0.6,
  followUpDecay: 0.5,
  maxFollowUps: 3,
  idleMs: 120_000,
  idleCapMessages: 4,
  beatRangeMs: [500, 500], // deterministic beat
};

const CTX: OrchestratorContext = {
  transcript: [],
  lastCharacterSpeakerId: null,
  lastMessage: null,
};

/** Judge answering from scripted queues; throws when a queue runs dry. */
function scriptedJudge(script: {
  first?: Array<string | null>;
  follow?: Array<string | null>;
  idle?: Array<string | null>;
}): RoomJudge {
  const take = (q?: Array<string | null>) => {
    if (!q || q.length === 0) throw new Error("judge exhausted");
    return Promise.resolve(q.shift()!);
  };
  return {
    firstSpeaker: () => take(script.first),
    followUpSpeaker: () => take(script.follow),
    idleSpeaker: () => take(script.idle),
  };
}

function harness(judge: RoomJudge, rngValues: number[], cfg: CascadeConfig = CFG) {
  const effects: OrchestratorEffect[] = [];
  const rng = () => (rngValues.length > 1 ? rngValues.shift()! : rngValues[0] ?? 0.5);
  const orch = new RoomOrchestrator(judge, ROSTER, cfg, rng, (fx) => effects.push(fx));
  const startTurns = () =>
    effects.filter((e): e is Extract<OrchestratorEffect, { type: "startTurn" }> => e.type === "startTurn");
  return { orch, effects, startTurns };
}

describe("RoomOrchestrator", () => {
  it("always answers a user post — judge pick", async () => {
    const { orch, startTurns } = harness(scriptedJudge({ first: ["jax"] }), [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "what a night" }, CTX);
    expect(startTurns()).toHaveLength(1);
    expect(startTurns()[0]!.speakerId).toBe("jax");
    expect(orch.getPhase()).toBe("generating");
  });

  it("mention heuristic skips the judge entirely", async () => {
    const judge = scriptedJudge({}); // any judge call would throw
    const { orch, startTurns } = harness(judge, [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "Elara, the lamp?" }, CTX);
    expect(startTurns()[0]!.speakerId).toBe("elara");
  });

  it("addressing several characters queues them all, in mention order, judge-free", async () => {
    const judge = scriptedJudge({ follow: [null] }); // only the post-queue gate may ask
    const { orch, startTurns } = harness(judge, [0.9, 0.1, 0.9]);
    await orch.handle(
      { type: "USER_POSTED", content: "Jax and Elara, what do you both think?" },
      CTX,
    );
    expect(startTurns().map((t) => t.speakerId)).toEqual(["jax"]);

    // Jax finishes → Elara speaks next deterministically (no roll consumed)
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "jax" }, CTX);
    expect(startTurns().map((t) => t.speakerId)).toEqual(["jax", "elara"]);
    expect(orch.getPhase()).toBe("generating");

    // queue drained → the normal stochastic gate resumes (roll passes, judge vetoes)
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[1]!.epoch, speakerId: "elara" }, CTX);
    expect(startTurns()).toHaveLength(2);
    expect(orch.getPhase()).toBe("idle");
  });

  it("the addressed queue outranks the quiet cap and survives it", async () => {
    const cfg = { ...CFG, idleCapMessages: 1 };
    const { orch, startTurns, effects } = harness(scriptedJudge({}), [0.9], cfg);
    await orch.handle({ type: "USER_POSTED", content: "Elara and Jax, both of you!" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "elara" }, CTX);
    // cap is 1, but Jax was explicitly addressed — he still answers
    expect(startTurns().map((t) => t.speakerId)).toEqual(["elara", "jax"]);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[1]!.epoch, speakerId: "jax" }, CTX);
    // then the room settles
    expect(orch.getPhase()).toBe("quiet");
    expect(effects.some((e) => e.type === "roomQuiet")).toBe(true);
  });

  it("a new user post clears any unanswered addressed queue", async () => {
    const { orch, startTurns } = harness(scriptedJudge({}), [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "Elara and Jax, thoughts?" }, CTX);
    // before anyone answers, the user redirects to Jax alone
    await orch.handle({ type: "USER_POSTED", content: "actually just Jax" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns().at(-1)!.epoch, speakerId: "jax" }, CTX);
    // roll (0.9 >= 0.6) fails → idle; Elara from the stale queue never speaks
    expect(startTurns().map((t) => t.speakerId)).toEqual(["elara", "jax"]);
    expect(orch.getPhase()).toBe("idle");
  });

  it("a failed turn drops the rest of the addressed queue", async () => {
    const { orch, startTurns } = harness(scriptedJudge({}), [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "Elara and Jax, thoughts?" }, CTX);
    await orch.handle({ type: "TURN_FAILED", epoch: startTurns()[0]!.epoch }, CTX);
    expect(orch.getPhase()).toBe("idle");
    expect(startTurns()).toHaveLength(1); // Jax is not marched into the same failure
  });

  it("direct-reply heuristic answers the character who asked", async () => {
    const { orch, startTurns } = harness(scriptedJudge({}), [0.9]);
    await orch.handle(
      { type: "USER_POSTED", content: "black, no sugar" },
      { ...CTX, lastMessage: { speakerId: "jax", endsWithQuestion: true } },
    );
    expect(startTurns()[0]!.speakerId).toBe("jax");
  });

  it("falls back to a random participant when the judge fails", async () => {
    const failing: RoomJudge = {
      firstSpeaker: () => Promise.reject(new Error("down")),
      followUpSpeaker: () => Promise.reject(new Error("down")),
      idleSpeaker: () => Promise.reject(new Error("down")),
    };
    const { orch, startTurns } = harness(failing, [0.0]);
    await orch.handle({ type: "USER_POSTED", content: "hm" }, CTX);
    expect(startTurns()).toHaveLength(1); // at-least-one guarantee holds
  });

  it("runs the decaying follow-up cascade: 0.6, 0.3, then a failing roll goes idle", async () => {
    const judge = scriptedJudge({ first: ["elara"], follow: ["jax", "elara"] });
    // rolls: 0.55 < 0.6 (pass), 0.25 < 0.3 (pass), 0.2 >= 0.15 (fail)
    const rngQueue = [
      0.9, // beat for first turn
      0.55, 0.9, // roll pass, beat
      0.25, 0.9, // roll pass, beat
      0.2, // roll fail → idle
    ];
    const { orch, effects, startTurns } = harness(judge, rngQueue);
    await orch.handle({ type: "USER_POSTED", content: "evening" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "elara" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[1]!.epoch, speakerId: "jax" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[2]!.epoch, speakerId: "elara" }, CTX);

    expect(startTurns().map((t) => t.speakerId)).toEqual(["elara", "jax", "elara"]);
    expect(orch.getPhase()).toBe("idle");
    expect(effects.some((e) => e.type === "armIdle")).toBe(true);
  });

  it("judge 'nobody' vetoes a passing roll", async () => {
    const judge = scriptedJudge({ first: ["elara"], follow: [null] });
    const { orch, startTurns, effects } = harness(judge, [0.9, 0.1, 0.9]);
    await orch.handle({ type: "USER_POSTED", content: "evening" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "elara" }, CTX);
    expect(startTurns()).toHaveLength(1);
    expect(orch.getPhase()).toBe("idle");
    expect(effects.filter((e) => e.type === "armIdle")).toHaveLength(1);
  });

  it("goes quiet at the consecutive-character cap and wakes on a user post", async () => {
    const cfg = { ...CFG, idleCapMessages: 2 };
    const judge = scriptedJudge({ first: ["elara", "jax"], follow: ["jax"] });
    const { orch, effects, startTurns } = harness(judge, [0.9, 0.0, 0.9], cfg); // roll always passes
    await orch.handle({ type: "USER_POSTED", content: "evening" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "elara" }, CTX);
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[1]!.epoch, speakerId: "jax" }, CTX);

    expect(orch.getPhase()).toBe("quiet");
    expect(effects.some((e) => e.type === "roomQuiet")).toBe(true);
    // no idle timer while quiet
    const armsBeforeUser = effects.filter((e) => e.type === "armIdle").length;
    expect(armsBeforeUser).toBe(0);

    await orch.handle({ type: "USER_POSTED", content: "still here" }, CTX);
    expect(orch.getPhase()).toBe("generating");
    expect(startTurns()).toHaveLength(3);
  });

  it("a user post mid-generation aborts and supersedes; stale TURN_DONE is ignored", async () => {
    const judge = scriptedJudge({ first: ["elara", "jax"] });
    const { orch, effects, startTurns } = harness(judge, [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "one" }, CTX);
    const staleEpoch = startTurns()[0]!.epoch;

    await orch.handle({ type: "USER_POSTED", content: "two, actually" }, CTX);
    expect(effects.some((e) => e.type === "abortGeneration")).toBe(true);
    expect(startTurns()).toHaveLength(2);

    // the aborted (or slow-cancelled) turn finishing must not advance anything
    const phaseBefore = orch.getPhase();
    await orch.handle({ type: "TURN_DONE", epoch: staleEpoch, speakerId: "elara" }, CTX);
    expect(orch.getPhase()).toBe(phaseBefore);
    await orch.handle({ type: "TURN_ABORTED", epoch: staleEpoch }, CTX);
    expect(orch.getPhase()).toBe(phaseBefore);
  });

  it("idle firing stirs a character and feeds the same cascade", async () => {
    const judge = scriptedJudge({ idle: ["jax"], follow: [null] });
    const { orch, startTurns } = harness(judge, [0.9, 0.1]);
    orch.start();
    await orch.handle({ type: "IDLE_FIRED" }, CTX);
    expect(startTurns()[0]!.speakerId).toBe("jax");
    await orch.handle({ type: "TURN_DONE", epoch: startTurns()[0]!.epoch, speakerId: "jax" }, CTX);
    expect(orch.getPhase()).toBe("idle"); // veto → back to idle, timer re-armed
  });

  it("idle firing while generating is ignored", async () => {
    const judge = scriptedJudge({ first: ["elara"] });
    const { orch, startTurns } = harness(judge, [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "hm" }, CTX);
    await orch.handle({ type: "IDLE_FIRED" }, CTX);
    expect(startTurns()).toHaveLength(1);
  });

  it("failed turns surface an error and re-arm the idle timer", async () => {
    const judge = scriptedJudge({ first: ["elara"] });
    const { orch, effects, startTurns } = harness(judge, [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "hm" }, CTX);
    await orch.handle({ type: "TURN_FAILED", epoch: startTurns()[0]!.epoch }, CTX);
    expect(orch.getPhase()).toBe("idle");
    expect(effects.some((e) => e.type === "error")).toBe(true);
    expect(effects.some((e) => e.type === "armIdle")).toBe(true);
  });

  it("ROOM_CLOSED makes the machine inert", async () => {
    const judge = scriptedJudge({ first: ["elara"] });
    const { orch, effects, startTurns } = harness(judge, [0.9]);
    await orch.handle({ type: "USER_POSTED", content: "hm" }, CTX);
    await orch.handle({ type: "ROOM_CLOSED" }, CTX);
    expect(effects.some((e) => e.type === "disarmIdle")).toBe(true);
    await orch.handle({ type: "USER_POSTED", content: "anyone?" }, CTX);
    expect(startTurns()).toHaveLength(1);
  });

  it("start() arms the idle timer for a fresh room; idleMs 0 never arms", () => {
    const a = harness(scriptedJudge({}), [0.5]);
    a.orch.start();
    expect(a.effects.some((e) => e.type === "armIdle")).toBe(true);

    const b = harness(scriptedJudge({}), [0.5], { ...CFG, idleMs: 0 });
    b.orch.start();
    expect(b.effects.some((e) => e.type === "armIdle")).toBe(false);
  });
});
