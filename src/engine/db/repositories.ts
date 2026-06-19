/* ============================================================
   Dragon Heart — repositories.
   The only place that knows the SQL ↔ domain mapping. Everything
   else works in domain objects. JSON columns (arrays, the Soul
   Document, embeddings) are (de)serialized here.
   ============================================================ */

import type { Db, Clock } from "../ports";
import { newId } from "../ports";
import { safeJsonParse } from "../util";
import type {
  AppSettings,
  Attachment,
  Character,
  Conversation,
  LoreEntry,
  LoreScope,
  Memory,
  Message,
  Persona,
  Relationship,
  Role,
  SoulDocument,
  User,
} from "../types";
import { DEFAULT_SETTINGS } from "../types";

const b = (v: unknown): boolean => Number(v) === 1;
const ib = (v: boolean): number => (v ? 1 : 0);
const j = (v: unknown): string => JSON.stringify(v ?? null);

type Row = Record<string, unknown>;

export type CharacterInput = Omit<Character, "id" | "createdAt" | "updatedAt">;
export type LoreInput = Omit<LoreEntry, "id" | "createdAt" | "updatedAt">;
export type MemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt" | "lastRecalledAt">;
export type MessageInput = Omit<Message, "id" | "createdAt">;

export class Repos {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  // ---------------- settings ----------------

  async getSettings(): Promise<AppSettings> {
    const rows = await this.db.select<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, [
      "settings",
    ]);
    if (rows.length === 0) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...safeJsonParse<Partial<AppSettings>>(rows[0]!.value, {}) };
  }

  async saveSettings(s: AppSettings): Promise<void> {
    await this.setMeta("settings", j(s));
  }

  /** Generic meta key/value (onboarding flag, etc.). */
  async getMeta(key: string): Promise<string | null> {
    const rows = await this.db.select<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, [key]);
    return rows[0] ? rows[0].value : null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  // ---------------- user & personas ----------------

  private rowToUser(r: Row): User {
    return {
      id: String(r.id),
      displayName: String(r.display_name),
      defaultPersonaId: String(r.default_persona_id ?? ""),
      createdAt: Number(r.created_at),
    };
  }

  async getPrimaryUser(): Promise<User | null> {
    const rows = await this.db.select<Row>(`SELECT * FROM user ORDER BY created_at ASC LIMIT 1`);
    return rows[0] ? this.rowToUser(rows[0]) : null;
  }

  /** Ensure a single primary user (with a default persona) exists. */
  async ensureUser(displayName: string): Promise<User> {
    const existing = await this.getPrimaryUser();
    if (existing) return existing;
    const now = this.clock.now();
    const userId = newId();
    const personaId = newId();
    await this.db.execute(
      `INSERT INTO user (id, display_name, default_persona_id, created_at) VALUES (?, ?, ?, ?)`,
      [userId, displayName, personaId, now],
    );
    await this.db.execute(
      `INSERT INTO persona (id, user_id, name, profile, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [personaId, userId, displayName, "", now, now],
    );
    return { id: userId, displayName, defaultPersonaId: personaId, createdAt: now };
  }

  async updateUser(user: User): Promise<void> {
    await this.db.execute(
      `UPDATE user SET display_name = ?, default_persona_id = ? WHERE id = ?`,
      [user.displayName, user.defaultPersonaId, user.id],
    );
  }

  private rowToPersona(r: Row): Persona {
    return {
      id: String(r.id),
      userId: String(r.user_id),
      name: String(r.name),
      profile: String(r.profile ?? ""),
      isDefault: b(r.is_default),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  async listPersonas(userId: string): Promise<Persona[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM persona WHERE user_id = ? ORDER BY is_default DESC, created_at ASC`,
      [userId],
    );
    return rows.map((r) => this.rowToPersona(r));
  }

  async getPersona(id: string): Promise<Persona | null> {
    const rows = await this.db.select<Row>(`SELECT * FROM persona WHERE id = ?`, [id]);
    return rows[0] ? this.rowToPersona(rows[0]) : null;
  }

  async createPersona(userId: string, name: string, profile: string): Promise<Persona> {
    const now = this.clock.now();
    const id = newId();
    await this.db.execute(
      `INSERT INTO persona (id, user_id, name, profile, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, userId, name, profile, now, now],
    );
    return { id, userId, name, profile, isDefault: false, createdAt: now, updatedAt: now };
  }

  async updatePersona(p: Persona): Promise<void> {
    await this.db.execute(
      `UPDATE persona SET name = ?, profile = ?, is_default = ?, updated_at = ? WHERE id = ?`,
      [p.name, p.profile, ib(p.isDefault), this.clock.now(), p.id],
    );
  }

  async deletePersona(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM persona WHERE id = ?`, [id]);
  }

  // ---------------- characters ----------------

  private rowToCharacter(r: Row): Character {
    return {
      id: String(r.id),
      name: String(r.name),
      epithet: String(r.epithet ?? ""),
      blurb: String(r.blurb ?? ""),
      soul: safeJsonParse<SoulDocument>(r.soul, {
        coreIdentity: "",
        drives: "",
        wounds: "",
        values: [],
        voice: "",
        relationalStance: "",
        knowledge: "",
        contradiction: "",
        tells: "",
        freeform: "",
      }),
      firstMessage: String(r.first_message ?? ""),
      greetingDropcap: b(r.greeting_dropcap),
      defaultModel: String(r.default_model),
      fastModel: r.fast_model ? String(r.fast_model) : null,
      mood: String(r.mood ?? "ember") as Character["mood"],
      status: String(r.status ?? "present") as Character["status"],
      avatarPath: r.avatar_path ? String(r.avatar_path) : null,
      traits: safeJsonParse<string[]>(r.traits, []),
      voicePreset: String(r.voice_preset ?? "Warm"),
      thinking: b(r.thinking),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  async listCharacters(): Promise<Character[]> {
    const rows = await this.db.select<Row>(`SELECT * FROM character ORDER BY created_at ASC`);
    return rows.map((r) => this.rowToCharacter(r));
  }

  async getCharacter(id: string): Promise<Character | null> {
    const rows = await this.db.select<Row>(`SELECT * FROM character WHERE id = ?`, [id]);
    return rows[0] ? this.rowToCharacter(rows[0]) : null;
  }

  async createCharacter(input: CharacterInput): Promise<Character> {
    const now = this.clock.now();
    const id = newId();
    const c: Character = { ...input, id, createdAt: now, updatedAt: now };
    await this.db.execute(
      `INSERT INTO character
       (id, name, epithet, blurb, soul, first_message, greeting_dropcap, default_model, fast_model,
        mood, status, avatar_path, traits, voice_preset, thinking, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        c.id, c.name, c.epithet, c.blurb, j(c.soul), c.firstMessage, ib(c.greetingDropcap),
        c.defaultModel, c.fastModel, c.mood, c.status, c.avatarPath, j(c.traits), c.voicePreset,
        ib(c.thinking), c.createdAt, c.updatedAt,
      ],
    );
    return c;
  }

  async updateCharacter(c: Character): Promise<void> {
    await this.db.execute(
      `UPDATE character SET name=?, epithet=?, blurb=?, soul=?, first_message=?, greeting_dropcap=?,
        default_model=?, fast_model=?, mood=?, status=?, avatar_path=?, traits=?, voice_preset=?,
        thinking=?, updated_at=? WHERE id=?`,
      [
        c.name, c.epithet, c.blurb, j(c.soul), c.firstMessage, ib(c.greetingDropcap), c.defaultModel,
        c.fastModel, c.mood, c.status, c.avatarPath, j(c.traits), c.voicePreset, ib(c.thinking),
        this.clock.now(), c.id,
      ],
    );
  }

  /** Delete a character and everything bound to it. */
  async deleteCharacter(id: string): Promise<void> {
    const rels = await this.db.select<Row>(`SELECT id FROM relationship WHERE character_id = ?`, [id]);
    for (const r of rels) await this.deleteRelationshipCascade(String(r.id));
    await this.db.execute(`DELETE FROM lore WHERE scope = 'character' AND owner_id = ?`, [id]);
    await this.db.execute(`DELETE FROM character WHERE id = ?`, [id]);
  }

  // ---------------- lore ----------------

  private rowToLore(r: Row): LoreEntry {
    return {
      id: String(r.id),
      scope: String(r.scope) as LoreScope,
      ownerId: String(r.owner_id),
      keys: safeJsonParse<string[]>(r.keys, []),
      content: String(r.content ?? ""),
      enabled: b(r.enabled),
      caseSensitive: b(r.case_sensitive),
      embedding: r.embedding ? safeJsonParse<number[] | null>(r.embedding, null) : null,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  async listLore(scope: LoreScope, ownerId: string): Promise<LoreEntry[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM lore WHERE scope = ? AND owner_id = ? ORDER BY created_at ASC`,
      [scope, ownerId],
    );
    return rows.map((r) => this.rowToLore(r));
  }

  async createLore(input: LoreInput): Promise<LoreEntry> {
    const now = this.clock.now();
    const id = newId();
    const e: LoreEntry = { ...input, id, createdAt: now, updatedAt: now };
    await this.db.execute(
      `INSERT INTO lore (id, scope, owner_id, keys, content, enabled, case_sensitive, embedding, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        e.id, e.scope, e.ownerId, j(e.keys), e.content, ib(e.enabled), ib(e.caseSensitive),
        e.embedding ? j(e.embedding) : null, e.createdAt, e.updatedAt,
      ],
    );
    return e;
  }

  async updateLore(e: LoreEntry): Promise<void> {
    await this.db.execute(
      `UPDATE lore SET keys=?, content=?, enabled=?, case_sensitive=?, embedding=?, updated_at=? WHERE id=?`,
      [
        j(e.keys), e.content, ib(e.enabled), ib(e.caseSensitive),
        e.embedding ? j(e.embedding) : null, this.clock.now(), e.id,
      ],
    );
  }

  async setLoreEmbedding(id: string, embedding: number[] | null): Promise<void> {
    await this.db.execute(`UPDATE lore SET embedding = ? WHERE id = ?`, [
      embedding ? j(embedding) : null,
      id,
    ]);
  }

  async deleteLore(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM lore WHERE id = ?`, [id]);
  }

  // ---------------- relationships ----------------

  private rowToRelationship(r: Row): Relationship {
    return {
      id: String(r.id),
      userId: String(r.user_id),
      characterId: String(r.character_id),
      profile: String(r.profile ?? ""),
      personaId: r.persona_id ? String(r.persona_id) : null,
      modelOverride: r.model_override ? String(r.model_override) : null,
      memoryDepth: String(r.memory_depth ?? "season") as Relationship["memoryDepth"],
      proactiveAllowed: b(r.proactive_allowed),
      showInnerMonologue: b(r.show_inner_monologue),
      allowTopicChange: b(r.allow_topic_change),
      mood: r.mood ? (String(r.mood) as Relationship["mood"]) : null,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  }

  async getRelationship(userId: string, characterId: string): Promise<Relationship | null> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM relationship WHERE user_id = ? AND character_id = ?`,
      [userId, characterId],
    );
    return rows[0] ? this.rowToRelationship(rows[0]) : null;
  }

  async getRelationshipById(id: string): Promise<Relationship | null> {
    const rows = await this.db.select<Row>(`SELECT * FROM relationship WHERE id = ?`, [id]);
    return rows[0] ? this.rowToRelationship(rows[0]) : null;
  }

  async ensureRelationship(userId: string, characterId: string): Promise<Relationship> {
    const existing = await this.getRelationship(userId, characterId);
    if (existing) return existing;
    const now = this.clock.now();
    const r: Relationship = {
      id: newId(),
      userId,
      characterId,
      profile: "",
      personaId: null,
      modelOverride: null,
      memoryDepth: "season",
      proactiveAllowed: false,
      showInnerMonologue: false,
      allowTopicChange: true,
      mood: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.execute(
      `INSERT INTO relationship
       (id, user_id, character_id, profile, persona_id, model_override, memory_depth,
        proactive_allowed, show_inner_monologue, allow_topic_change, mood, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        r.id, r.userId, r.characterId, r.profile, r.personaId, r.modelOverride, r.memoryDepth,
        ib(r.proactiveAllowed), ib(r.showInnerMonologue), ib(r.allowTopicChange), r.mood,
        r.createdAt, r.updatedAt,
      ],
    );
    return r;
  }

  async updateRelationship(r: Relationship): Promise<void> {
    await this.db.execute(
      `UPDATE relationship SET profile=?, persona_id=?, model_override=?, memory_depth=?,
        proactive_allowed=?, show_inner_monologue=?, allow_topic_change=?, mood=?, updated_at=? WHERE id=?`,
      [
        r.profile, r.personaId, r.modelOverride, r.memoryDepth, ib(r.proactiveAllowed),
        ib(r.showInnerMonologue), ib(r.allowTopicChange), r.mood, this.clock.now(), r.id,
      ],
    );
  }

  private async deleteRelationshipCascade(relationshipId: string): Promise<void> {
    const convs = await this.db.select<Row>(`SELECT id FROM conversation WHERE relationship_id = ?`, [
      relationshipId,
    ]);
    for (const c of convs) {
      await this.db.execute(`DELETE FROM message WHERE conversation_id = ?`, [String(c.id)]);
    }
    await this.db.execute(`DELETE FROM conversation WHERE relationship_id = ?`, [relationshipId]);
    await this.db.execute(`DELETE FROM memory WHERE relationship_id = ?`, [relationshipId]);
    await this.db.execute(`DELETE FROM lore WHERE scope = 'relationship' AND owner_id = ?`, [
      relationshipId,
    ]);
    await this.db.execute(`DELETE FROM relationship WHERE id = ?`, [relationshipId]);
  }

  // ---------------- conversations ----------------

  private rowToConversation(r: Row): Conversation {
    return {
      id: String(r.id),
      relationshipId: String(r.relationship_id),
      title: r.title ? String(r.title) : null,
      sceneState: r.scene_state ? String(r.scene_state) : null,
      startedAt: Number(r.started_at),
      updatedAt: Number(r.updated_at),
      lastSummaryThroughMessageId: r.last_summary_through_message_id
        ? String(r.last_summary_through_message_id)
        : null,
    };
  }

  async listConversations(relationshipId: string): Promise<Conversation[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM conversation WHERE relationship_id = ? ORDER BY updated_at DESC`,
      [relationshipId],
    );
    return rows.map((r) => this.rowToConversation(r));
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const rows = await this.db.select<Row>(`SELECT * FROM conversation WHERE id = ?`, [id]);
    return rows[0] ? this.rowToConversation(rows[0]) : null;
  }

  async getLatestConversation(relationshipId: string): Promise<Conversation | null> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM conversation WHERE relationship_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [relationshipId],
    );
    return rows[0] ? this.rowToConversation(rows[0]) : null;
  }

  async createConversation(relationshipId: string, sceneState: string | null = null): Promise<Conversation> {
    const now = this.clock.now();
    const c: Conversation = {
      id: newId(),
      relationshipId,
      title: null,
      sceneState,
      startedAt: now,
      updatedAt: now,
      lastSummaryThroughMessageId: null,
    };
    await this.db.execute(
      `INSERT INTO conversation (id, relationship_id, title, scene_state, started_at, updated_at, last_summary_through_message_id)
       VALUES (?,?,?,?,?,?,?)`,
      [c.id, c.relationshipId, c.title, c.sceneState, c.startedAt, c.updatedAt, c.lastSummaryThroughMessageId],
    );
    return c;
  }

  async updateConversation(c: Conversation): Promise<void> {
    await this.db.execute(
      `UPDATE conversation SET title=?, scene_state=?, updated_at=?, last_summary_through_message_id=? WHERE id=?`,
      [c.title, c.sceneState, this.clock.now(), c.lastSummaryThroughMessageId, c.id],
    );
  }

  async touchConversation(id: string): Promise<void> {
    await this.db.execute(`UPDATE conversation SET updated_at = ? WHERE id = ?`, [this.clock.now(), id]);
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM message WHERE conversation_id = ?`, [id]);
    await this.db.execute(`DELETE FROM conversation WHERE id = ?`, [id]);
  }

  // ---------------- messages ----------------

  private rowToMessage(r: Row): Message {
    return {
      id: String(r.id),
      conversationId: String(r.conversation_id),
      role: String(r.role) as Role,
      content: String(r.content ?? ""),
      attachments: safeJsonParse<Attachment[]>(r.attachments, []),
      tokens: Number(r.tokens ?? 0),
      createdAt: Number(r.created_at),
      summarized: b(r.summarized),
    };
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM message WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`,
      [conversationId],
    );
    return rows.map((r) => this.rowToMessage(r));
  }

  async listUnsummarized(conversationId: string): Promise<Message[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM message WHERE conversation_id = ? AND summarized = 0 ORDER BY created_at ASC, rowid ASC`,
      [conversationId],
    );
    return rows.map((r) => this.rowToMessage(r));
  }

  async addMessage(input: MessageInput): Promise<Message> {
    const m: Message = { ...input, id: newId(), createdAt: this.clock.now() };
    await this.db.execute(
      `INSERT INTO message (id, conversation_id, role, content, attachments, tokens, created_at, summarized)
       VALUES (?,?,?,?,?,?,?,?)`,
      [m.id, m.conversationId, m.role, m.content, j(m.attachments), m.tokens, m.createdAt, ib(m.summarized)],
    );
    await this.touchConversation(m.conversationId);
    return m;
  }

  async markSummarized(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.db.execute(`UPDATE message SET summarized = 1 WHERE id = ?`, [id]);
    }
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM message WHERE id = ?`, [id]);
  }

  // ---------------- memories ----------------

  private rowToMemory(r: Row): Memory {
    return {
      id: String(r.id),
      relationshipId: String(r.relationship_id),
      content: String(r.content ?? ""),
      kind: String(r.kind ?? "fact") as Memory["kind"],
      keys: safeJsonParse<string[]>(r.keys, []),
      embedding: r.embedding ? safeJsonParse<number[] | null>(r.embedding, null) : null,
      salience: Number(r.salience ?? 0.5),
      sourceMessageIds: safeJsonParse<string[]>(r.source_message_ids, []),
      pinned: b(r.pinned),
      enabled: b(r.enabled),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      lastRecalledAt: r.last_recalled_at ? Number(r.last_recalled_at) : null,
    };
  }

  async listMemories(relationshipId: string): Promise<Memory[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM memory WHERE relationship_id = ? ORDER BY created_at DESC`,
      [relationshipId],
    );
    return rows.map((r) => this.rowToMemory(r));
  }

  async listEnabledMemories(relationshipId: string): Promise<Memory[]> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM memory WHERE relationship_id = ? AND enabled = 1`,
      [relationshipId],
    );
    return rows.map((r) => this.rowToMemory(r));
  }

  async latestSummary(relationshipId: string): Promise<Memory | null> {
    const rows = await this.db.select<Row>(
      `SELECT * FROM memory WHERE relationship_id = ? AND kind = 'summary' AND enabled = 1 ORDER BY created_at DESC LIMIT 1`,
      [relationshipId],
    );
    return rows[0] ? this.rowToMemory(rows[0]) : null;
  }

  async createMemory(input: MemoryInput): Promise<Memory> {
    const now = this.clock.now();
    const m: Memory = { ...input, id: newId(), createdAt: now, updatedAt: now, lastRecalledAt: null };
    await this.db.execute(
      `INSERT INTO memory
       (id, relationship_id, content, kind, keys, embedding, salience, source_message_ids, pinned, enabled, created_at, updated_at, last_recalled_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        m.id, m.relationshipId, m.content, m.kind, j(m.keys), m.embedding ? j(m.embedding) : null,
        m.salience, j(m.sourceMessageIds), ib(m.pinned), ib(m.enabled), m.createdAt, m.updatedAt, m.lastRecalledAt,
      ],
    );
    return m;
  }

  async updateMemory(m: Memory): Promise<void> {
    await this.db.execute(
      `UPDATE memory SET content=?, kind=?, keys=?, embedding=?, salience=?, pinned=?, enabled=?, updated_at=?, last_recalled_at=? WHERE id=?`,
      [
        m.content, m.kind, j(m.keys), m.embedding ? j(m.embedding) : null, m.salience, ib(m.pinned),
        ib(m.enabled), this.clock.now(), m.lastRecalledAt, m.id,
      ],
    );
  }

  async setMemoryEmbedding(id: string, embedding: number[] | null): Promise<void> {
    await this.db.execute(`UPDATE memory SET embedding = ? WHERE id = ?`, [
      embedding ? j(embedding) : null,
      id,
    ]);
  }

  async touchRecalled(ids: string[], now: number): Promise<void> {
    for (const id of ids) {
      await this.db.execute(`UPDATE memory SET last_recalled_at = ? WHERE id = ?`, [now, id]);
    }
  }

  async deleteMemory(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM memory WHERE id = ?`, [id]);
  }
}
