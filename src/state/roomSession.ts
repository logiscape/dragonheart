/* ============================================================
   Dragon Heart — room session.
   The effect interpreter for one open room: the orchestrator (pure,
   in the engine) decides who speaks and when; this owns everything
   worldly — wall-clock timers (the pre-typing beat, the idle timer),
   the AbortController for the in-flight stream, visibility gating,
   and the calls into Engine. Deps are injected so tests can drive
   it with a fake scheduler and no DOM.
   ============================================================ */

import {
  RoomOrchestrator,
  TurnAbortedError,
  type CascadeConfig,
  type Engine,
  type Message,
  type OrchestratorContext,
  type OrchestratorEffect,
  type RoomPhase,
  type RoomView,
  type RosterEntry,
  type TranscriptLine,
} from "@engine/index";
import type { Attachment } from "@engine/index";

export interface Scheduler {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

export interface Visibility {
  isVisible(): boolean;
  /** fires on every visibility change; returns an unsubscribe */
  subscribe(cb: (visible: boolean) => void): () => void;
}

export interface RoomSessionCallbacks {
  onPhase(phase: RoomPhase): void;
  /** a persisted message (user or character) to append to the timeline */
  onMessage(message: Message): void;
  /** live typing state: who is speaking and the text so far ("" = thinking) */
  onStreaming(characterId: string | null, text: string): void;
  onError(message: string): void;
}

export interface RoomSessionDeps {
  engine: Engine;
  scheduler: Scheduler;
  visibility: Visibility;
  rng: () => number;
  callbacks: RoomSessionCallbacks;
}

const TRANSCRIPT_LINES = 10;

export class RoomSession {
  private readonly orchestrator: RoomOrchestrator;
  private readonly roomId: string;
  private readonly roster: RosterEntry[];
  private readonly userName: string;
  private messages: Message[];

  private beatTimer: number | null = null;
  private idleTimer: number | null = null;
  /** the interval last requested by armIdle; >0 means "should be armed" */
  private idleWantedMs = 0;
  private abortController: AbortController | null = null;
  private spokeSinceMaintenance: string[] = [];
  private unsubscribeVisibility: () => void;
  private disposed = false;

  constructor(
    room: RoomView,
    cfg: CascadeConfig,
    private readonly deps: RoomSessionDeps,
  ) {
    this.roomId = room.conversation.id;
    this.messages = [...room.messages];
    this.userName = deps.engine.getUser().displayName;
    this.roster = room.participants.map((p) => ({
      id: p.character.id,
      name: p.character.name,
      epithet: p.character.epithet,
      blurb: p.character.blurb,
    }));
    const judge = deps.engine.createRoomJudge(this.roster, deps.rng);
    this.orchestrator = new RoomOrchestrator(judge, this.roster, cfg, deps.rng, (fx) =>
      this.applyEffect(fx),
    );
    this.unsubscribeVisibility = deps.visibility.subscribe((visible) =>
      this.onVisibilityChange(visible),
    );
    this.orchestrator.start();
  }

  /** Persist the user's message immediately, then let the room react. */
  async postUserMessage(content: string, attachments: Attachment[] = []): Promise<void> {
    if (this.disposed) return;
    const message = await this.deps.engine.postUserMessage(this.roomId, content, attachments);
    if (this.disposed) return;
    this.messages.push(message);
    this.deps.callbacks.onMessage(message);
    void this.orchestrator
      .handle({ type: "USER_POSTED", content }, this.context())
      .catch((e) => console.error("room orchestration failed:", e));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    void this.orchestrator.handle({ type: "ROOM_CLOSED" }, this.context()).catch(() => {});
    this.clearBeat();
    this.clearIdle();
    this.abortController?.abort();
    this.abortController = null;
    this.unsubscribeVisibility();
    this.flushMaintenance();
  }

  // ---------------- orchestrator effects ----------------

  private applyEffect(fx: OrchestratorEffect): void {
    switch (fx.type) {
      case "phase":
        this.deps.callbacks.onPhase(fx.phase);
        // a cascade has settled — run the deferred affect/rollup work now,
        // so background calls never queue on Ollama between speakers
        if (fx.phase === "idle" || fx.phase === "quiet") this.flushMaintenance();
        return;
      case "startTurn":
        this.clearBeat();
        // the character "notices" the moment before they start typing
        this.deps.callbacks.onStreaming(fx.speakerId, "");
        this.beatTimer = this.deps.scheduler.set(() => {
          this.beatTimer = null;
          void this.runTurn(fx.speakerId, fx.epoch);
        }, fx.beatMs);
        return;
      case "abortGeneration":
        this.clearBeat();
        this.abortController?.abort();
        this.deps.callbacks.onStreaming(null, "");
        return;
      case "armIdle":
        this.idleWantedMs = fx.ms;
        this.armIdleIfVisible();
        return;
      case "disarmIdle":
        this.idleWantedMs = 0;
        this.clearIdle();
        return;
      case "roomQuiet":
        return; // the phase effect already carried it to the UI
      case "error":
        this.deps.callbacks.onError(fx.message);
        return;
    }
  }

  private async runTurn(speakerId: string, epoch: number): Promise<void> {
    if (this.disposed) return;
    const controller = new AbortController();
    this.abortController = controller;
    try {
      const result = await this.deps.engine.generateCharacterTurn(this.roomId, speakerId, {
        onToken: (_d, full) => this.deps.callbacks.onStreaming(speakerId, full),
        signal: controller.signal,
        deferMaintenance: true,
      });
      if (this.abortController === controller) this.abortController = null;
      this.messages.push(result.message);
      this.spokeSinceMaintenance.push(speakerId);
      this.deps.callbacks.onStreaming(null, "");
      this.deps.callbacks.onMessage(result.message);
      void this.orchestrator
        .handle({ type: "TURN_DONE", epoch, speakerId }, this.context())
        .catch((e) => console.error("room orchestration failed:", e));
    } catch (e) {
      if (this.abortController === controller) this.abortController = null;
      this.deps.callbacks.onStreaming(null, "");
      if (e instanceof TurnAbortedError) {
        void this.orchestrator.handle({ type: "TURN_ABORTED", epoch }, this.context()).catch(() => {});
        return;
      }
      console.error("character turn failed:", e);
      void this.orchestrator
        .handle({ type: "TURN_FAILED", epoch, error: e }, this.context())
        .catch(() => {});
    }
  }

  // ---------------- idle timer & visibility ----------------

  private armIdleIfVisible(): void {
    this.clearIdle();
    if (this.disposed || this.idleWantedMs <= 0) return;
    if (!this.deps.visibility.isVisible()) return; // re-armed on refocus
    this.idleTimer = this.deps.scheduler.set(() => {
      this.idleTimer = null;
      void this.orchestrator
        .handle({ type: "IDLE_FIRED" }, this.context())
        .catch((e) => console.error("room orchestration failed:", e));
    }, this.idleWantedMs);
  }

  private onVisibilityChange(visible: boolean): void {
    if (this.disposed) return;
    if (!visible) {
      this.clearIdle();
    } else {
      // restart the full interval — simple, predictable, errs quiet
      this.armIdleIfVisible();
    }
  }

  private clearBeat(): void {
    if (this.beatTimer !== null) {
      this.deps.scheduler.clear(this.beatTimer);
      this.beatTimer = null;
    }
  }

  private clearIdle(): void {
    if (this.idleTimer !== null) {
      this.deps.scheduler.clear(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // ---------------- context & maintenance ----------------

  private context(): OrchestratorContext {
    const nameById = new Map(this.roster.map((r) => [r.id, r.name]));
    const recent = this.messages.filter((m) => m.role !== "system").slice(-TRANSCRIPT_LINES);
    const transcript: TranscriptLine[] = recent.map((m) => ({
      speaker:
        m.role === "assistant"
          ? (m.speakerCharacterId && nameById.get(m.speakerCharacterId)) || "Someone"
          : this.userName,
      text: m.content,
    }));
    const lastCharacter = [...recent]
      .reverse()
      .find((m) => m.role === "assistant" && m.speakerCharacterId);
    const last = recent[recent.length - 1];
    return {
      transcript,
      lastCharacterSpeakerId: lastCharacter?.speakerCharacterId ?? null,
      lastMessage: last
        ? {
            speakerId: last.role === "assistant" ? last.speakerCharacterId : null,
            endsWithQuestion: last.content.trimEnd().endsWith("?"),
          }
        : null,
    };
  }

  private flushMaintenance(): void {
    if (this.spokeSinceMaintenance.length === 0) return;
    const spoke = [...this.spokeSinceMaintenance];
    this.spokeSinceMaintenance = [];
    void this.deps.engine
      .runRoomMaintenance(this.roomId, spoke)
      .catch((e) => console.error("room maintenance failed:", e));
  }
}
