/* ============================================================
   Dragon Heart — room turn orchestrator.
   The conversational rhythm of a gathering: the user always gets a
   first response (heuristics, then judge, then a hard fallback);
   after each character reply a decaying coin-flip plus a judge veto
   decides whether someone else chimes in; a long silence stirs one
   character awake; after enough character messages with no user
   post, the room settles until they speak again.

   Pure decision-making: no timers, no Tauri, no UI. It emits
   effects; the store-side RoomSession executes them (scheduling,
   streaming, aborting) and feeds events back. Epochs guard against
   races — a stale TURN_DONE from a slow or failed cancel is simply
   ignored.
   ============================================================ */

import type { RoomJudge, RosterEntry, TranscriptLine } from "./roomJudge";
import { findMentionedSpeakers, isDirectReply } from "./roomJudge";

export type RoomPhase = "idle" | "selecting" | "generating" | "quiet";

export type OrchestratorEvent =
  | { type: "USER_POSTED"; content: string }
  | { type: "TURN_DONE"; epoch: number; speakerId: string }
  | { type: "TURN_FAILED"; epoch: number; error?: unknown }
  | { type: "TURN_ABORTED"; epoch: number }
  | { type: "IDLE_FIRED" }
  | { type: "ROOM_CLOSED" };

export type OrchestratorEffect =
  | { type: "abortGeneration" }
  | { type: "startTurn"; speakerId: string; epoch: number; beatMs: number }
  | { type: "armIdle"; ms: number }
  | { type: "disarmIdle" }
  | { type: "roomQuiet" }
  | { type: "phase"; phase: RoomPhase }
  | { type: "error"; message: string };

/** What the session knows about the room right now, computed per event. */
export interface OrchestratorContext {
  /** recent labeled history, oldest → newest */
  transcript: TranscriptLine[];
  /** the character who spoke most recently, if the last stretch had one */
  lastCharacterSpeakerId: string | null;
  /** the very last room message, for the direct-reply heuristic */
  lastMessage: { speakerId: string | null; endsWithQuestion: boolean } | null;
}

export interface CascadeConfig {
  /** base probability that anyone follows up after a reply */
  followUpBase: number;
  /** multiplier per follow-up already given (0.6 → 0.3 → 0.15 …) */
  followUpDecay: number;
  /** hard stop on follow-ups per cascade */
  maxFollowUps: number;
  /** silence before a character stirs; 0 disables the idle timer */
  idleMs: number;
  /** consecutive character messages (no user post) before the room settles */
  idleCapMessages: number;
  /** pre-typing pause so replies don't machine-gun */
  beatRangeMs: [number, number];
}

export const DEFAULT_CASCADE: Omit<CascadeConfig, "followUpBase" | "idleMs" | "idleCapMessages"> = {
  followUpDecay: 0.5,
  maxFollowUps: 3,
  beatRangeMs: [500, 1200],
};

export type Rng = () => number;

export class RoomOrchestrator {
  private phase: RoomPhase = "idle";
  private ticket = 0; // monotonic; the live turn/selection holds the newest
  private currentEpoch = 0;
  private followUpCount = 0;
  private consecutiveCharMsgs = 0;
  private lastSpeakerId: string | null = null;
  /** characters the user explicitly addressed who haven't answered yet — they
   *  all speak, in address order (asked-a-question first, then mention order),
   *  before the stochastic follow-ups resume */
  private addressedQueue: string[] = [];
  private closed = false;

  constructor(
    private readonly judge: RoomJudge,
    private readonly roster: RosterEntry[],
    private readonly cfg: CascadeConfig,
    private readonly rng: Rng,
    private readonly emit: (fx: OrchestratorEffect) => void,
  ) {}

  getPhase(): RoomPhase {
    return this.phase;
  }

  /** Arm the idle timer for a freshly opened room. */
  start(): void {
    if (!this.closed && this.phase === "idle") this.armIdle();
  }

  async handle(ev: OrchestratorEvent, ctx: OrchestratorContext): Promise<void> {
    if (this.closed) return;
    switch (ev.type) {
      case "USER_POSTED":
        return this.onUserPosted(ev.content, ctx);
      case "TURN_DONE":
        return this.onTurnDone(ev.epoch, ev.speakerId, ctx);
      case "TURN_FAILED":
        if (ev.epoch !== this.currentEpoch) return;
        this.addressedQueue = []; // don't march the rest into the same failure
        this.setPhase("idle");
        this.emit({ type: "error", message: "The reply faltered." });
        this.armIdle();
        return;
      case "TURN_ABORTED":
        // aborts are always requested by a USER_POSTED that has already
        // driven the machine forward; nothing to do
        return;
      case "IDLE_FIRED":
        return this.onIdleFired(ctx);
      case "ROOM_CLOSED":
        this.closed = true;
        this.emit({ type: "abortGeneration" });
        this.emit({ type: "disarmIdle" });
        return;
    }
  }

  // ---------------- transitions ----------------

  private async onUserPosted(content: string, ctx: OrchestratorContext): Promise<void> {
    if (this.phase === "generating" || this.phase === "selecting") {
      this.emit({ type: "abortGeneration" });
    }
    this.emit({ type: "disarmIdle" });
    this.followUpCount = 0;
    this.consecutiveCharMsgs = 0;
    this.addressedQueue = [];
    const ticket = ++this.ticket; // supersedes any in-flight selection or turn
    this.setPhase("selecting");

    // everyone addressed by name answers, in address order (whoever was asked
    // a question goes first); the first speaks now, the rest are queued ahead
    // of any stochastic follow-ups
    const mentioned = findMentionedSpeakers(content, this.roster);
    if (mentioned.length > 0) {
      this.addressedQueue = mentioned.slice(1);
      this.startTurn(mentioned[0]!, ticket);
      return;
    }

    const speakerId = await this.selectFirstResponder(content, ctx);
    if (this.stale(ticket)) return;
    this.startTurn(speakerId, ticket);
  }

  private async onTurnDone(
    epoch: number,
    speakerId: string,
    ctx: OrchestratorContext,
  ): Promise<void> {
    if (epoch !== this.currentEpoch || this.phase !== "generating") return;
    this.consecutiveCharMsgs++;
    this.lastSpeakerId = speakerId;

    // explicitly-addressed characters still owed an answer speak next — no
    // roll, no judge, and the quiet cap doesn't cut off what the user asked
    // for (it still counts toward it, so the room settles soon after)
    const queued = this.addressedQueue.shift();
    if (queued) {
      this.startTurn(queued, ++this.ticket);
      return;
    }

    if (this.consecutiveCharMsgs >= this.cfg.idleCapMessages) {
      this.setPhase("quiet");
      this.emit({ type: "roomQuiet" });
      return;
    }

    // roll first (free), judge second (costs a prefill). The most talkative
    // of the others sets the room's eagerness: 0.5 is neutral, 1.0 doubles
    // the base chance, near-0 all but mutes the cascade.
    const eager = Math.max(
      0,
      ...this.roster.filter((r) => r.id !== speakerId).map((r) => r.talkativeness ?? 0.5),
    );
    const p =
      this.followUpCount >= this.cfg.maxFollowUps
        ? 0
        : Math.min(
            0.95,
            this.cfg.followUpBase *
              Math.pow(this.cfg.followUpDecay, this.followUpCount) *
              (eager / 0.5),
          );
    if (this.rng() >= p) {
      this.setPhase("idle");
      this.armIdle();
      return;
    }

    const ticket = ++this.ticket;
    this.setPhase("selecting");
    const next = await this.safeJudge(() => this.judge.followUpSpeaker(ctx.transcript, speakerId));
    if (this.stale(ticket)) return;
    if (!next) {
      // the judge says the moment is complete (or failed — fail quiet)
      this.setPhase("idle");
      this.armIdle();
      return;
    }
    this.followUpCount++;
    this.startTurn(next, ticket);
  }

  private async onIdleFired(ctx: OrchestratorContext): Promise<void> {
    if (this.phase !== "idle") return;
    const ticket = ++this.ticket;
    this.setPhase("selecting");
    // a reopened session hasn't seen a TURN_DONE yet — fall back to the
    // last speaker the session read out of the persisted history
    const lastSpeakerId = this.lastSpeakerId ?? ctx.lastCharacterSpeakerId;
    let speakerId = await this.safeJudge(() =>
      this.judge.idleSpeaker(ctx.transcript, lastSpeakerId),
    );
    if (this.stale(ticket)) return;
    // weighted fallback: a stir shouldn't default back to whoever spoke last
    if (!speakerId) speakerId = this.weightedSpeaker();
    if (!speakerId) {
      this.setPhase("idle");
      this.armIdle();
      return;
    }
    this.startTurn(speakerId, ticket);
  }

  // ---------------- selection ----------------

  /** For posts that named nobody (mentions are handled in onUserPosted). */
  private async selectFirstResponder(
    userText: string,
    ctx: OrchestratorContext,
  ): Promise<string> {
    // 1. a short answer to whoever just asked the room something
    if (isDirectReply(userText, ctx.lastMessage) && ctx.lastMessage?.speakerId) {
      return ctx.lastMessage.speakerId;
    }
    // 2. the judge, for genuinely ambiguous moments
    const judged = await this.safeJudge(() =>
      this.judge.firstSpeaker(userText, ctx.transcript),
    );
    if (judged) return judged;
    // 3. never leave the user unanswered
    return this.fallbackSpeaker() ?? this.roster[0]!.id;
  }

  private fallbackSpeaker(): string | null {
    if (this.lastSpeakerId && this.roster.some((r) => r.id === this.lastSpeakerId)) {
      return this.lastSpeakerId;
    }
    return this.weightedSpeaker();
  }

  /** Talkativeness-weighted random pick; uniform when the weights vanish. */
  private weightedSpeaker(): string | null {
    if (this.roster.length === 0) return null;
    const weights = this.roster.map((r) => Math.max(0, r.talkativeness ?? 0.5));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return this.roster[Math.floor(this.rng() * this.roster.length)]!.id;
    let roll = this.rng() * total;
    for (let i = 0; i < this.roster.length; i++) {
      roll -= weights[i]!;
      if (roll < 0) return this.roster[i]!.id;
    }
    return this.roster[this.roster.length - 1]!.id;
  }

  private async safeJudge(fn: () => Promise<string | null>): Promise<string | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }

  // ---------------- plumbing ----------------

  /** A newer event superseded this async continuation, or the room closed. */
  private stale(ticket: number): boolean {
    return this.closed || ticket !== this.ticket;
  }

  private startTurn(speakerId: string, ticket: number): void {
    this.currentEpoch = ticket;
    const [lo, hi] = this.cfg.beatRangeMs;
    const beatMs = Math.round(lo + this.rng() * Math.max(0, hi - lo));
    this.setPhase("generating");
    this.emit({ type: "startTurn", speakerId, epoch: ticket, beatMs });
  }

  private armIdle(): void {
    if (this.cfg.idleMs > 0) this.emit({ type: "armIdle", ms: this.cfg.idleMs });
  }

  private setPhase(phase: RoomPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit({ type: "phase", phase });
  }
}
