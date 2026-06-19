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
import { assembleContext, resolveModel } from "./context";
import { triggerLore } from "./lorebook";
import {
  rankMemoriesForRecall,
  summarizeRollup,
  extractMemories,
  shouldRollup,
  type MemoryCandidate,
} from "./memory";
import { estimateTokens, estimateMessageTokens } from "./tokens";
import { parseJsonLoose } from "./util";
import { soulToPrompt, blankSoul } from "./soul";
import { runProbes, DEFAULT_PROBES, type Probe, type ProbeResult } from "./personaProbe";
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
import { starterCharacters } from "./seed";

export * from "./types";
export { DEFAULT_PROBES } from "./personaProbe";
export type { Probe, ProbeResult } from "./personaProbe";

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
  async seedStartersIfEmpty(): Promise<void> {
    const existing = await this.repos.listCharacters();
    if (existing.length > 0) return;
    for (const c of starterCharacters(this.settings.defaultModel, this.settings.fastModel)) {
      await this.repos.createCharacter(c);
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
{"coreIdentity":"","drives":"","wounds":"","values":["",""],"voice":"","relationalStance":"","knowledge":"","contradiction":"","tells":""}`;
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
    const soul = blankSoul();
    return {
      ...soul,
      ...parsed,
      values: Array.isArray(parsed.values) ? parsed.values.filter((v) => typeof v === "string") : [],
      freeform: "",
    };
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
    const relationship = await this.repos.getRelationshipById(conversation.relationshipId);
    if (!relationship) throw new Error("Relationship not found");
    const character = await this.repos.getCharacter(relationship.characterId);
    if (!character) throw new Error("Character not found");
    const personaId = relationship.personaId ?? this.user.defaultPersonaId;
    const persona = personaId ? await this.repos.getPersona(personaId) : null;
    return { conversation, relationship, character, persona };
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

  private async maybeRollup(conversationId: string): Promise<void> {
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
