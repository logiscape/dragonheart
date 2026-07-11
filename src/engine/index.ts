/* ============================================================
   Dragon Heart — Engine facade.
   The clean, UI-free public surface the app talks to. Composes the
   repositories, the Ollama client, the layered context assembler,
   and the memory/lore subsystems into the high-level operations a
   warm companion app needs. Pure logic lives in the modules; this
   wires them together and owns the turn loop.
   ============================================================ */

import type { Db, OllamaTransport, Clock } from "./ports";
import { systemClock } from "./ports";
import { initSchema } from "./db/schema";
import { Repos } from "./db/repositories";
import { OllamaClient } from "./ollama";
import { assembleContext, resolveModel, resolveRoomModel, sanitizeGroupReply } from "./context";
import { triggerLore } from "./lorebook";
import {
  rankMemoriesForRecall,
  summarizeRollup,
  summarizeGroupRollup,
  formatGroupTranscript,
  extractMemories,
  shouldRollup,
  type GroupSpeaker,
  type MemoryCandidate,
} from "./memory";
import { estimateTokens, estimateMessageTokens } from "./tokens";
import { parseJsonLoose } from "./util";
import { soulToPrompt, blankSoul, normalizeSoul } from "./soul";
import { runProbes, DEFAULT_PROBES, type Probe, type ProbeResult } from "./personaProbe";
import { createOllamaRoomJudge, type RoomJudge, type RosterEntry } from "./roomJudge";
import {
  parseCardBytes,
  cardToDraft,
  characterToCard,
  cardToJsonBytes,
  embedCardInPng,
} from "./characterCard";
import type {
  AppSettings,
  Attachment,
  BudgetReport,
  Character,
  Conversation,
  LoreEntry,
  LoreScope,
  Memory,
  MemoryKind,
  Message,
  OllamaModelInfo,
  Persona,
  Relationship,
  SoulDocument,
  User,
} from "./types";
import { starterCharacters, starterLore } from "./seed";

export * from "./types";
export { DEFAULT_PROBES } from "./personaProbe";
export type { Probe, ProbeResult } from "./personaProbe";
export { RoomOrchestrator, DEFAULT_CASCADE } from "./orchestrator";
export type {
  CascadeConfig,
  OrchestratorContext,
  OrchestratorEffect,
  OrchestratorEvent,
  RoomPhase,
} from "./orchestrator";
export type { RoomJudge, RosterEntry, TranscriptLine } from "./roomJudge";
export { sanitizeGroupReply } from "./context";

export interface ConversationView {
  relationship: Relationship;
  conversation: Conversation;
  messages: Message[];
}

export interface SendDiagnostics {
  recalledMemories: Memory[];
  triggeredLore: LoreEntry[];
  budget: BudgetReport;
}

export interface SendResult {
  user: Message;
  assistant: Message;
  thinking: string;
  diagnostics: SendDiagnostics;
}

export interface SendOptions {
  onToken?: (delta: string, full: string) => void;
}

// ---------------- group rooms ----------------

export interface RoomParticipantView {
  character: Character;
  /** the user × character bond — memories, affect, persona all live here */
  relationship: Relationship;
  joinedAt: number;
  leftAt: number | null;
  talkativeness: number;
}

export interface RoomView {
  conversation: Conversation;
  /** currently present participants */
  participants: RoomParticipantView[];
  messages: Message[];
}

export interface TurnOptions {
  onToken?: (delta: string, full: string) => void;
  /** abort the generation; the turn throws TurnAbortedError, persisting nothing */
  signal?: AbortSignal;
  /** skip per-turn rollup/affect; the caller batches them via runRoomMaintenance */
  deferMaintenance?: boolean;
}

export interface CharacterTurnResult {
  message: Message;
  thinking: string;
  diagnostics: SendDiagnostics;
}

/** Thrown when a character turn is aborted mid-stream; nothing was persisted. */
export class TurnAbortedError extends Error {
  constructor() {
    super("Character turn aborted");
    this.name = "TurnAbortedError";
  }
}

export interface CharacterDraftInput {
  name: string;
  epithet?: string;
  blurb?: string;
  soul: SoulDocument;
  firstMessage?: string;
  greetingDropcap?: boolean;
  mood?: Character["mood"];
  status?: Character["status"];
  traits?: string[];
  voicePreset?: string;
  thinking?: boolean;
  defaultModel?: string;
  fastModel?: string | null;
  avatarPath?: string | null;
}

export class Engine {
  /** conversations with a rollup pass running — turns can finish in quick
   *  succession in rooms, and the same slice must not be summarized twice */
  private rollupInFlight = new Set<string>();

  private constructor(
    readonly repos: Repos,
    readonly ollama: OllamaClient,
    private readonly clock: Clock,
    private settings: AppSettings,
    private user: User,
  ) {}

  static async create(
    db: Db,
    transport: OllamaTransport,
    clock: Clock = systemClock,
  ): Promise<Engine> {
    await initSchema(db);
    const repos = new Repos(db, clock);
    const settings = await repos.getSettings();
    const user = await repos.ensureUser("traveller");
    return new Engine(repos, new OllamaClient(transport), clock, settings, user);
  }

  // ---------------- state ----------------

  getSettings(): AppSettings {
    return this.settings;
  }
  getUser(): User {
    return this.user;
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    this.settings = { ...this.settings, ...patch };
    await this.repos.saveSettings(this.settings);
    return this.settings;
  }

  async setUserName(name: string): Promise<User> {
    this.user = { ...this.user, displayName: name };
    await this.repos.updateUser(this.user);
    return this.user;
  }

  async isOnboarded(): Promise<boolean> {
    return (await this.repos.getMeta("onboarded")) === "1";
  }
  async markOnboarded(): Promise<void> {
    await this.repos.setMeta("onboarded", "1");
  }

  // ---------------- embeddings ----------------

  /** Embed text for recall, or null when semantic recall is off/unavailable. */
  async embed(text: string): Promise<number[] | null> {
    if (!this.settings.semanticRecall || !this.settings.embeddingModel.trim()) return null;
    const t = text.trim();
    if (!t) return null;
    try {
      return await this.ollama.embedOne(this.settings.embeddingModel, t);
    } catch {
      return null;
    }
  }

  // ---------------- characters ----------------

  async listCharacters(): Promise<Character[]> {
    return this.repos.listCharacters();
  }
  getCharacter(id: string): Promise<Character | null> {
    return this.repos.getCharacter(id);
  }

  /** Seed the starter circle on first run so the Hall has presence. */
  async seedStartersIfEmpty(avatars: Record<string, string> = {}): Promise<void> {
    const existing = await this.repos.listCharacters();
    if (existing.length > 0) return;
    for (const c of starterCharacters(this.settings.defaultModel, this.settings.fastModel, avatars)) {
      const created = await this.repos.createCharacter(c);
      for (const l of starterLore(created.name, created.id)) {
        await this.repos.createLore(l);
      }
    }
  }

  async createCharacter(draft: CharacterDraftInput): Promise<Character> {
    return this.repos.createCharacter({
      name: draft.name,
      epithet: draft.epithet ?? "",
      blurb: draft.blurb ?? "",
      soul: draft.soul,
      firstMessage: draft.firstMessage ?? "",
      greetingDropcap: draft.greetingDropcap ?? true,
      defaultModel: draft.defaultModel ?? this.settings.defaultModel,
      fastModel: draft.fastModel ?? this.settings.fastModel,
      mood: draft.mood ?? "ember",
      status: draft.status ?? "present",
      avatarPath: draft.avatarPath ?? null,
      traits: draft.traits ?? [],
      voicePreset: draft.voicePreset ?? "Warm",
      thinking: draft.thinking ?? false,
    });
  }

  async updateCharacter(c: Character): Promise<void> {
    await this.repos.updateCharacter(c);
  }
  async deleteCharacter(id: string): Promise<void> {
    await this.repos.deleteCharacter(id);
  }

  blankSoul(): SoulDocument {
    return blankSoul();
  }

  /** Generate a first-draft Soul Document from a short sketch, using the model. */
  async draftSoulFromSketch(name: string, sketch: string): Promise<SoulDocument> {
    const sys = `You are a character designer. From a brief sketch, write a Soul Document describing WHO a character is (drives, wounds, values, voice) — not what tasks they do. Behavior should emerge from identity.

Return ONLY JSON with this shape:
{"coreIdentity":"","drives":"","wounds":"","values":["",""],"voice":"","relationalStance":"","knowledge":"","contradiction":"","tells":"","registers":[{"when":"<situation>","how":"<how the voice changes>"}],"exampleDialogue":[{"user":"<something said to them>","character":"<their reply, in their true voice>"}]}

registers: 2-3 entries — how the voice shifts between situations (no one speaks in a single register).
exampleDialogue: 2-3 short exchanges showing the voice in practice, each in a different register.`;
    const res = await this.ollama.chat({
      model: this.settings.fastModel || this.settings.defaultModel,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Name: ${name}\nSketch: ${sketch}` },
      ],
      options: { temperature: 0.7 },
      stream: false,
    });
    const parsed = parseJsonLoose<Partial<SoulDocument>>(res.content) ?? {};
    // The model can emit null/missing fields; normalize so downstream rendering
    // (soulToPrompt) never trips on a non-string field. freeform stays empty —
    // a guided draft is structured, not a verbatim override.
    return normalizeSoul({ ...parsed, freeform: "" });
  }

  // ---------------- relationships / conversations ----------------

  async openCharacter(characterId: string): Promise<ConversationView> {
    const relationship = await this.repos.ensureRelationship(this.user.id, characterId);
    let conversation = await this.repos.getLatestConversation(relationship.id);
    if (!conversation) {
      conversation = await this.newConversationInternal(relationship, characterId);
    }
    const messages = await this.repos.listMessages(conversation.id);
    return { relationship, conversation, messages };
  }

  private async newConversationInternal(
    relationship: Relationship,
    characterId: string,
  ): Promise<Conversation> {
    const conversation = await this.repos.createConversation(relationship.id, null);
    const character = await this.repos.getCharacter(characterId);
    const greeting = character?.firstMessage.trim();
    if (greeting) {
      await this.repos.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: greeting,
        attachments: [],
        tokens: estimateTokens(greeting),
        summarized: false,
      });
    }
    return conversation;
  }

  async newConversation(relationshipId: string): Promise<ConversationView> {
    const relationship = await this.repos.getRelationshipById(relationshipId);
    if (!relationship) throw new Error("Relationship not found");
    const conversation = await this.newConversationInternal(relationship, relationship.characterId);
    const messages = await this.repos.listMessages(conversation.id);
    return { relationship, conversation, messages };
  }

  async listConversations(relationshipId: string): Promise<Conversation[]> {
    return this.repos.listConversations(relationshipId);
  }
  async getThread(conversationId: string): Promise<Message[]> {
    return this.repos.listMessages(conversationId);
  }
  async deleteConversation(conversationId: string): Promise<void> {
    await this.repos.deleteConversation(conversationId);
  }

  private async loadBundle(conversationId: string): Promise<{
    conversation: Conversation;
    relationship: Relationship;
    character: Character;
    persona: Persona | null;
  }> {
    const conversation = await this.repos.getConversation(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.relationshipId) throw new Error("Not a direct conversation");
    const relationship = await this.repos.getRelationshipById(conversation.relationshipId);
    if (!relationship) throw new Error("Relationship not found");
    const character = await this.repos.getCharacter(relationship.characterId);
    if (!character) throw new Error("Character not found");
    const personaId = relationship.personaId ?? this.user.defaultPersonaId;
    const persona = personaId ? await this.repos.getPersona(personaId) : null;
    return { conversation, relationship, character, persona };
  }

  // ---------------- group rooms ----------------

  async createRoom(
    name: string,
    characterIds: string[],
    sceneState: string | null = null,
  ): Promise<RoomView> {
    const conversation = await this.repos.createRoomConversation(name, sceneState);
    for (const id of characterIds) {
      // joining a room gives a character the same bond row a first 1:1 open
      // would — their memories/affect/persona work identically in both
      await this.repos.ensureRelationship(this.user.id, id);
      await this.repos.addParticipant(conversation.id, id);
    }
    return this.openRoom(conversation.id);
  }

  async openRoom(conversationId: string): Promise<RoomView> {
    const conversation = await this.repos.getConversation(conversationId);
    if (!conversation || conversation.kind !== "room") throw new Error("Room not found");
    const participants = await this.loadParticipants(conversationId);
    const messages = await this.repos.listMessages(conversationId);
    return { conversation, participants, messages };
  }

  async listRooms(): Promise<Conversation[]> {
    return this.repos.listRoomConversations();
  }

  async addRoomParticipant(conversationId: string, characterId: string): Promise<RoomView> {
    await this.repos.ensureRelationship(this.user.id, characterId);
    await this.repos.addParticipant(conversationId, characterId);
    return this.openRoom(conversationId);
  }

  async removeRoomParticipant(conversationId: string, characterId: string): Promise<RoomView> {
    await this.repos.removeParticipant(conversationId, characterId);
    return this.openRoom(conversationId);
  }

  private async loadParticipants(
    conversationId: string,
    includeLeft = false,
  ): Promise<RoomParticipantView[]> {
    const rows = await this.repos.listParticipants(conversationId, includeLeft);
    const out: RoomParticipantView[] = [];
    for (const p of rows) {
      const character = await this.repos.getCharacter(p.characterId);
      if (!character) continue; // deleted character — soft-left already
      const relationship = await this.repos.ensureRelationship(this.user.id, p.characterId);
      out.push({
        character,
        relationship,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        talkativeness: p.talkativeness,
      });
    }
    return out;
  }

  /** A judge for a room's roster, on the shared model — see roomJudge.ts. */
  createRoomJudge(roster: RosterEntry[], rng?: () => number): RoomJudge {
    return createOllamaRoomJudge(this.ollama, {
      model: resolveRoomModel(this.settings),
      numCtx: this.settings.numCtx,
      roster,
      userName: this.user.displayName,
      ...(rng ? { rng } : {}),
    });
  }

  /** Persist a user message into a room, decoupled from any generation. */
  async postUserMessage(
    conversationId: string,
    content: string,
    attachments: Attachment[] = [],
  ): Promise<Message> {
    const conversation = await this.repos.getConversation(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    return this.repos.addMessage({
      conversationId,
      role: "user",
      content,
      attachments,
      tokens: estimateTokens(content),
      summarized: false,
    });
  }

  /**
   * One character speaks in a room. Mirrors `send()` with the speaker's own
   * full layered context (soul, bond, private memories, lore) — the fidelity
   * guarantee — over speaker-labeled shared history. The user's message, if
   * any, is already in history (postUserMessage), so `newUser` is null.
   */
  async generateCharacterTurn(
    conversationId: string,
    characterId: string,
    opts: TurnOptions = {},
  ): Promise<CharacterTurnResult> {
    const conversation = await this.repos.getConversation(conversationId);
    if (!conversation || conversation.kind !== "room") throw new Error("Room not found");
    const participants = await this.loadParticipants(conversationId);
    const self = participants.find((p) => p.character.id === characterId);
    if (!self) throw new Error("Character is not present in this room");
    const { character, relationship } = self;
    const personaId = relationship.personaId ?? this.user.defaultPersonaId;
    const persona = personaId ? await this.repos.getPersona(personaId) : null;

    const verbatim = await this.repos.listUnsummarized(conversationId);
    const speakers: GroupSpeaker[] = participants.map((p) => ({
      id: p.character.id,
      name: p.character.name,
    }));
    const recentText = formatGroupTranscript(verbatim.slice(-6), speakers, this.user.displayName);
    const queryEmbedding = await this.embed(recentText);

    // Layer 4 — this speaker's own recall + lore
    const recalled = await this.recallForRoom(
      relationship.id,
      conversationId,
      recentText,
      queryEmbedding,
    );
    const lore = await this.triggeredLore(character.id, relationship.id, recentText, queryEmbedding);

    // rooms pin one model + one num_ctx for every call — never a runner reload
    const model = resolveRoomModel(this.settings);
    const assembled = assembleContext({
      numCtx: this.settings.numCtx,
      temperature: this.settings.temperature,
      model,
      character,
      persona,
      userName: this.user.displayName,
      relationship,
      conversation,
      verbatim,
      newUser: null,
      triggeredLore: lore,
      recalledMemories: recalled,
      now: this.clock.now(),
      group: {
        roomName: conversation.title ?? "The gathering",
        selfCharacterId: character.id,
        participants: participants.map((p) => ({
          id: p.character.id,
          name: p.character.name,
          epithet: p.character.epithet,
          blurb: p.character.blurb,
        })),
      },
    });

    if (opts.signal?.aborted) throw new TurnAbortedError();
    const result = await this.ollama.chat(
      assembled.request,
      opts.onToken,
      opts.signal ? { signal: opts.signal } : undefined,
    );
    if (opts.signal?.aborted || result.doneReason === "cancel") throw new TurnAbortedError();

    const otherNames = [
      this.user.displayName,
      ...participants.filter((p) => p.character.id !== characterId).map((p) => p.character.name),
    ];
    const replyText = sanitizeGroupReply(result.content, character.name, otherNames) || "…";
    const message = await this.repos.addMessage({
      conversationId,
      role: "assistant",
      content: replyText,
      attachments: [],
      speakerCharacterId: characterId,
      tokens: result.evalCount || estimateTokens(replyText),
      summarized: false,
    });

    if (recalled.length) {
      await this.repos.touchRecalled(recalled.map((m) => m.id), this.clock.now());
    }

    if (!opts.deferMaintenance) {
      void this.runRoomMaintenance(conversationId, [characterId]).catch((e) =>
        console.error("room maintenance failed:", e),
      );
    }

    return {
      message,
      thinking: result.thinking,
      diagnostics: { recalledMemories: recalled, triggeredLore: lore, budget: assembled.budget },
    };
  }

  /**
   * Deferred background work after a cascade: one affect note per character
   * who spoke, then the rollup check. Kept sequential so the calls queue
   * behind each other rather than piling onto Ollama between speakers.
   */
  async runRoomMaintenance(conversationId: string, spokeCharacterIds: string[]): Promise<void> {
    const conversation = await this.repos.getConversation(conversationId);
    if (!conversation || conversation.kind !== "room") return;
    const participants = await this.loadParticipants(conversationId);
    const speakers: GroupSpeaker[] = participants.map((p) => ({
      id: p.character.id,
      name: p.character.name,
    }));
    const verbatim = await this.repos.listUnsummarized(conversationId);
    const excerpt = formatGroupTranscript(verbatim.slice(-8), speakers, this.user.displayName);
    const model = resolveRoomModel(this.settings);
    const roomName = conversation.title ?? "the gathering";

    for (const id of [...new Set(spokeCharacterIds)]) {
      const p = participants.find((x) => x.character.id === id);
      if (!p || !excerpt.trim()) continue;
      await this.updateAffectFromTranscript(p.relationship.id, p.character, excerpt, model, roomName);
    }
    await this.maybeRollupRoom(conversationId);
  }

  /** Room recall: the speaker's own memories, plus the room's own continuity summary. */
  private async recallForRoom(
    relationshipId: string,
    conversationId: string,
    recentText: string,
    queryEmbedding: number[] | null,
  ): Promise<Memory[]> {
    const memories = await this.repos.listEnabledMemories(relationshipId);
    const ranked = rankMemoriesForRecall(memories, {
      queryEmbedding,
      recentText,
      now: this.clock.now(),
      k: 6,
    });
    const latest = await this.repos.latestRoomSummary(conversationId);
    if (latest && !ranked.some((m) => m.id === latest.id)) ranked.unshift(latest);
    return ranked;
  }

  /**
   * Room rollup: one tagged pass over the speaker-labeled transcript. The
   * summary stays room-scoped (shared continuity); each tagged fact is copied
   * into every retaining character's own relationship, which is what carries
   * it back into their one-on-one conversations.
   */
  private async maybeRollupRoom(conversationId: string): Promise<void> {
    if (this.rollupInFlight.has(conversationId)) return;
    this.rollupInFlight.add(conversationId);
    try {
      const conversation = await this.repos.getConversation(conversationId);
      if (!conversation || conversation.kind !== "room") return;
      const unsummarized = await this.repos.listUnsummarized(conversationId);
      const historyTokens = unsummarized.reduce((s, m) => s + estimateMessageTokens(m), 0);
      if (!shouldRollup(historyTokens, this.settings.rollupThresholdTokens)) return;

      const keepN = this.settings.recentVerbatimTurns;
      if (unsummarized.length <= keepN) return;
      const older = unsummarized.slice(0, unsummarized.length - keepN);
      if (older.length === 0) return;

      // include departed participants: they may have spoken in (and should
      // retain memories from) the slice being folded out
      const everyone = await this.loadParticipants(conversationId, true);
      const speakers: GroupSpeaker[] = everyone.map((p) => ({
        id: p.character.id,
        name: p.character.name,
      }));

      const model = resolveRoomModel(this.settings);
      const { summary, facts } = await summarizeGroupRollup(
        this.ollama,
        model,
        this.settings.numCtx,
        older,
        speakers,
        this.user.displayName,
      );

      if (summary) {
        const embedding = await this.embed(summary.content);
        await this.repos.createMemory({
          relationshipId: null,
          roomId: conversationId,
          content: summary.content,
          kind: summary.kind,
          keys: summary.keys,
          embedding,
          salience: summary.salience,
          sourceMessageIds: summary.sourceMessageIds,
          pinned: false,
          enabled: true,
        });
      }
      for (const fact of facts) {
        // embed once; the vector depends only on the content
        const embedding = await this.embed(fact.content);
        for (const characterId of fact.retainedByIds) {
          const holder = everyone.find((p) => p.character.id === characterId);
          if (!holder) continue;
          await this.repos.createMemory({
            relationshipId: holder.relationship.id,
            roomId: conversationId,
            content: fact.content,
            kind: fact.kind,
            keys: fact.keys,
            embedding,
            salience: fact.salience,
            sourceMessageIds: fact.sourceMessageIds,
            pinned: false,
            enabled: true,
          });
        }
      }

      await this.repos.markSummarized(older.map((m) => m.id));
      const lastOlder = older[older.length - 1];
      if (lastOlder) {
        await this.repos.updateConversation({
          ...conversation,
          lastSummaryThroughMessageId: lastOlder.id,
        });
      }
    } finally {
      this.rollupInFlight.delete(conversationId);
    }
  }

  // ---------------- the turn loop ----------------

  async send(
    conversationId: string,
    content: string,
    attachments: Attachment[] = [],
    opts: SendOptions = {},
  ): Promise<SendResult> {
    const { conversation, relationship, character, persona } = await this.loadBundle(conversationId);
    const verbatim = await this.repos.listUnsummarized(conversationId);

    const recentText = [
      verbatim.slice(-4).map((m) => m.content).join("\n"),
      content,
    ]
      .filter(Boolean)
      .join("\n");
    const queryEmbedding = await this.embed(recentText);

    // Layer 4 — recall + lore
    const recalled = await this.recall(relationship.id, recentText, queryEmbedding);
    const lore = await this.triggeredLore(character.id, relationship.id, recentText, queryEmbedding);

    // time awareness: when they last exchanged a message, before this turn
    const lastInteractionAt = await this.repos.latestMessageTime(relationship.id);

    const model = resolveModel(relationship, character, this.settings.defaultModel);
    const assembled = assembleContext({
      numCtx: this.settings.numCtx,
      temperature: this.settings.temperature,
      model,
      character,
      persona,
      userName: this.user.displayName,
      relationship,
      conversation,
      verbatim,
      newUser: { content, attachments },
      triggeredLore: lore,
      recalledMemories: recalled,
      now: this.clock.now(),
      lastInteractionAt,
    });

    const userMsg = await this.repos.addMessage({
      conversationId,
      role: "user",
      content,
      attachments,
      tokens: estimateTokens(content),
      summarized: false,
    });

    const result = await this.ollama.chat(assembled.request, opts.onToken);
    const replyText = result.content.trim() || "…";
    const assistantMsg = await this.repos.addMessage({
      conversationId,
      role: "assistant",
      content: replyText,
      attachments: [],
      tokens: result.evalCount || estimateTokens(replyText),
      summarized: false,
    });

    if (recalled.length) {
      await this.repos.touchRecalled(recalled.map((m) => m.id), this.clock.now());
    }

    // long-term memory rollup runs in the background; never blocks the reply
    void this.maybeRollup(conversationId).catch((e) => console.error("rollup failed:", e));

    // carried feeling: note privately how the exchange landed, for next turn.
    // Runs on the same model that generated the reply so it never forces Ollama
    // to unload/reload a second model between turns.
    void this.updateAffectFromTranscript(
      relationship.id,
      character,
      `${this.user.displayName}: ${content}\n${character.name}: ${replyText}`,
      model,
    ).catch((e) => console.error("affect update failed:", e));

    return {
      user: userMsg,
      assistant: assistantMsg,
      thinking: result.thinking,
      diagnostics: { recalledMemories: recalled, triggeredLore: lore, budget: assembled.budget },
    };
  }

  private async recall(
    relationshipId: string,
    recentText: string,
    queryEmbedding: number[] | null,
  ): Promise<Memory[]> {
    const memories = await this.repos.listEnabledMemories(relationshipId);
    const ranked = rankMemoriesForRecall(memories, {
      queryEmbedding,
      recentText,
      now: this.clock.now(),
      k: 6,
    });
    // always carry the most recent rollup summary for baseline continuity
    const latest = await this.repos.latestSummary(relationshipId);
    if (latest && !ranked.some((m) => m.id === latest.id)) ranked.unshift(latest);
    return ranked;
  }

  private async triggeredLore(
    characterId: string,
    relationshipId: string,
    recentText: string,
    queryEmbedding: number[] | null,
  ): Promise<LoreEntry[]> {
    const charLore = await this.repos.listLore("character", characterId);
    const relLore = await this.repos.listLore("relationship", relationshipId);
    const hits = triggerLore([...charLore, ...relLore], recentText, {
      queryEmbedding,
      semanticThreshold: 0.55,
      maxEntries: 8,
    });
    return hits.map((h) => h.entry);
  }

  /**
   * Carried emotional state: after a reply, ask the model for a one-line,
   * first-person note of how the exchange left the character feeling about the
   * user. Injected into Layer 3 next turn, so feeling persists across turns
   * and sessions. Background only — never blocks the reply. Runs on the same
   * model that generated the reply (passed in) to avoid an Ollama model swap.
   * In rooms, the excerpt is a speaker-labeled slice and `roomName` is set.
   */
  private async updateAffectFromTranscript(
    relationshipId: string,
    character: Character,
    excerpt: string,
    model: string,
    roomName?: string,
  ): Promise<void> {
    const setting = roomName
      ? ` The exchange happened in the shared room "${roomName}", with others present.`
      : "";
    const sys = `You are the private inner voice of ${character.name}.${setting} Given the latest exchange, write ONE sentence (under 25 words), first person, noting how it left you feeling about ${this.user.displayName} and anything you're carrying into next time. Be honest — warmth, hurt, worry, delight, all allowed. Return ONLY the sentence.`;
    const result = await this.ollama.chat({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: excerpt },
      ],
      // match the reply's context size so Ollama reuses the loaded runner
      // rather than reloading the model for a smaller window
      options: { num_ctx: this.settings.numCtx, temperature: 0.4 },
      stream: false,
    });
    const affect = result.content.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 300);
    if (!affect) return;
    // re-read: the relationship may have been edited while the model thought
    const rel = await this.repos.getRelationshipById(relationshipId);
    if (!rel) return;
    await this.repos.updateRelationship({ ...rel, affect });
  }

  private async maybeRollup(conversationId: string): Promise<void> {
    if (this.rollupInFlight.has(conversationId)) return;
    this.rollupInFlight.add(conversationId);
    try {
      const { conversation, relationship, character } = await this.loadBundle(conversationId);
      const unsummarized = await this.repos.listUnsummarized(conversationId);
      const historyTokens = unsummarized.reduce((s, m) => s + estimateMessageTokens(m), 0);
      if (!shouldRollup(historyTokens, this.settings.rollupThresholdTokens)) return;

      const keepN = this.settings.recentVerbatimTurns;
      if (unsummarized.length <= keepN) return;
      const older = unsummarized.slice(0, unsummarized.length - keepN);
      if (older.length === 0) return;

      const model = this.settings.fastModel || resolveModel(relationship, character, this.settings.defaultModel);
      const { summary, facts } = await summarizeRollup(
        this.ollama,
        model,
        older,
        character.name,
        this.user.displayName,
      );
      const candidates: MemoryCandidate[] = [...(summary ? [summary] : []), ...facts];
      for (const c of candidates) {
        const embedding = await this.embed(c.content);
        await this.repos.createMemory({
          relationshipId: relationship.id,
          content: c.content,
          kind: c.kind,
          keys: c.keys,
          embedding,
          salience: c.salience,
          sourceMessageIds: c.sourceMessageIds,
          pinned: false,
          enabled: true,
        });
      }
      await this.repos.markSummarized(older.map((m) => m.id));
      const lastOlder = older[older.length - 1];
      if (lastOlder) {
        await this.repos.updateConversation({
          ...conversation,
          lastSummaryThroughMessageId: lastOlder.id,
        });
      }
    } finally {
      this.rollupInFlight.delete(conversationId);
    }
  }

  // ---------------- memory ----------------

  listMemories(relationshipId: string): Promise<Memory[]> {
    return this.repos.listMemories(relationshipId);
  }

  async addMemory(
    relationshipId: string,
    content: string,
    kind: MemoryKind = "fact",
    keys: string[] = [],
    pinned = false,
  ): Promise<Memory> {
    const embedding = await this.embed(content);
    return this.repos.createMemory({
      relationshipId,
      content,
      kind,
      keys,
      embedding,
      salience: pinned ? 0.8 : 0.5,
      sourceMessageIds: [],
      pinned,
      enabled: true,
    });
  }

  async updateMemory(m: Memory, reEmbed = false): Promise<void> {
    if (reEmbed) m = { ...m, embedding: await this.embed(m.content) };
    await this.repos.updateMemory(m);
  }
  async deleteMemory(id: string): Promise<void> {
    await this.repos.deleteMemory(id);
  }

  /** Extract durable memories from the recent exchange on demand (the user's
   *  "remember that?" affordance). Returns the freshly-created memories. */
  async extractMemoriesNow(conversationId: string): Promise<Memory[]> {
    const conversation = await this.repos.getConversation(conversationId);
    if (conversation?.kind === "room") return this.extractRoomMemoriesNow(conversationId);
    const { relationship, character } = await this.loadBundle(conversationId);
    const recent = (await this.repos.listUnsummarized(conversationId)).slice(-10);
    if (recent.length === 0) return [];
    const candidates = await extractMemories(
      this.ollama,
      this.settings.fastModel || this.settings.defaultModel,
      recent,
      character.name,
      this.user.displayName,
    );
    const created: Memory[] = [];
    for (const c of candidates) {
      const embedding = await this.embed(c.content);
      created.push(
        await this.repos.createMemory({
          relationshipId: relationship.id,
          content: c.content,
          kind: c.kind,
          keys: c.keys,
          embedding,
          salience: c.salience,
          sourceMessageIds: c.sourceMessageIds,
          pinned: false,
          enabled: true,
        }),
      );
    }
    return created;
  }

  /** Room variant of extractMemoriesNow: the same tagged pass as room rollup,
   *  fanned out to each retaining participant (no room summary is written). */
  private async extractRoomMemoriesNow(conversationId: string): Promise<Memory[]> {
    const recent = (await this.repos.listUnsummarized(conversationId)).slice(-10);
    if (recent.length === 0) return [];
    const everyone = await this.loadParticipants(conversationId, true);
    const speakers: GroupSpeaker[] = everyone.map((p) => ({
      id: p.character.id,
      name: p.character.name,
    }));
    const { facts } = await summarizeGroupRollup(
      this.ollama,
      resolveRoomModel(this.settings),
      this.settings.numCtx,
      recent,
      speakers,
      this.user.displayName,
    );
    const created: Memory[] = [];
    for (const fact of facts) {
      const embedding = await this.embed(fact.content);
      for (const characterId of fact.retainedByIds) {
        const holder = everyone.find((p) => p.character.id === characterId);
        if (!holder) continue;
        created.push(
          await this.repos.createMemory({
            relationshipId: holder.relationship.id,
            roomId: conversationId,
            content: fact.content,
            kind: fact.kind,
            keys: fact.keys,
            embedding,
            salience: fact.salience,
            sourceMessageIds: fact.sourceMessageIds,
            pinned: false,
            enabled: true,
          }),
        );
      }
    }
    return created;
  }

  // ---------------- lore ----------------

  listLore(scope: LoreScope, ownerId: string): Promise<LoreEntry[]> {
    return this.repos.listLore(scope, ownerId);
  }

  async createLore(
    scope: LoreScope,
    ownerId: string,
    keys: string[],
    content: string,
    opts: { enabled?: boolean; caseSensitive?: boolean } = {},
  ): Promise<LoreEntry> {
    const embedding = await this.embed(content);
    return this.repos.createLore({
      scope,
      ownerId,
      keys,
      content,
      enabled: opts.enabled ?? true,
      caseSensitive: opts.caseSensitive ?? false,
      embedding,
    });
  }

  async updateLore(e: LoreEntry, reEmbed = false): Promise<void> {
    if (reEmbed) e = { ...e, embedding: await this.embed(e.content) };
    await this.repos.updateLore(e);
  }
  async deleteLore(id: string): Promise<void> {
    await this.repos.deleteLore(id);
  }

  // ---------------- personas ----------------

  listPersonas(): Promise<Persona[]> {
    return this.repos.listPersonas(this.user.id);
  }
  createPersona(name: string, profile: string): Promise<Persona> {
    return this.repos.createPersona(this.user.id, name, profile);
  }
  async updatePersona(p: Persona): Promise<void> {
    await this.repos.updatePersona(p);
  }
  async deletePersona(id: string): Promise<void> {
    await this.repos.deletePersona(id);
  }
  async setDefaultPersona(personaId: string): Promise<void> {
    this.user = { ...this.user, defaultPersonaId: personaId };
    await this.repos.updateUser(this.user);
  }

  // ---------------- relationship editing ----------------

  getRelationship(id: string): Promise<Relationship | null> {
    return this.repos.getRelationshipById(id);
  }
  async updateRelationship(r: Relationship): Promise<void> {
    await this.repos.updateRelationship(r);
  }
  async updateConversation(c: Conversation): Promise<void> {
    await this.repos.updateConversation(c);
  }

  // ---------------- models / health ----------------

  listModels(): Promise<OllamaModelInfo[]> {
    return this.ollama.listModels();
  }
  ollamaVersion(): Promise<string | null> {
    return this.ollama.version();
  }

  // ---------------- persona probe harness ----------------

  runProbes(
    character: Character,
    onResult?: (r: ProbeResult, i: number, total: number) => void,
    probes: Probe[] = DEFAULT_PROBES,
  ): Promise<ProbeResult[]> {
    const model = character.defaultModel || this.settings.defaultModel;
    return runProbes(this.ollama, model, character, probes, {
      numCtx: Math.min(this.settings.numCtx, 8192),
      temperature: this.settings.temperature,
      ...(onResult ? { onResult } : {}),
    });
  }

  // ---------------- character cards ----------------

  async importCard(bytes: Uint8Array): Promise<Character> {
    const card = parseCardBytes(bytes);
    if (!card) throw new Error("That file isn't a character card I recognize.");
    const draft = cardToDraft(card);
    const character = await this.createCharacter({
      name: draft.name,
      epithet: draft.epithet,
      blurb: draft.blurb,
      soul: draft.soul,
      firstMessage: draft.firstMessage,
      greetingDropcap: draft.greetingDropcap,
      traits: draft.traits,
    });
    for (const l of draft.loreDrafts) {
      const embedding = await this.embed(l.content);
      await this.repos.createLore({
        scope: "character",
        ownerId: character.id,
        keys: l.keys,
        content: l.content,
        enabled: l.enabled,
        caseSensitive: l.caseSensitive,
        embedding,
      });
    }
    return character;
  }

  async exportCardJson(characterId: string): Promise<Uint8Array> {
    const card = await this.buildCard(characterId);
    return cardToJsonBytes(card);
  }

  async exportCardPng(characterId: string, basePng: Uint8Array): Promise<Uint8Array> {
    const card = await this.buildCard(characterId);
    return embedCardInPng(card, basePng);
  }

  private async buildCard(characterId: string) {
    const character = await this.repos.getCharacter(characterId);
    if (!character) throw new Error("Character not found");
    const lore = await this.repos.listLore("character", characterId);
    const soulText = character.soul.freeform?.trim() || soulToPrompt(character);
    return characterToCard({
      name: character.name,
      epithet: character.epithet,
      blurb: character.blurb,
      soulText,
      voice: character.soul.voice,
      firstMessage: character.firstMessage,
      scenario: "",
      traits: character.traits,
      lore: lore.map((l) => ({
        keys: l.keys,
        content: l.content,
        enabled: l.enabled,
        caseSensitive: l.caseSensitive,
      })),
    });
  }
}
