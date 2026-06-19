/* ============================================================
   Dragon Heart — domain types.
   The shared vocabulary of the engine. Everything else (context
   assembly, memory, repositories, the UI store) is typed against
   these. Mirrors the data model in the concept plan §5, expanded
   to the layered context model §4 and the relationship model §7.
   ============================================================ */

export type ID = string;

/** Mood drives the accent color of a character's presence (design system). */
export type Mood = "ember" | "heart" | "moss" | "arcane";

export type CharacterStatus = "present" | "away" | "dormant";

export type Role = "system" | "user" | "assistant";

// ---------------------------------------------------------------
// Layer 1 — the Soul Document (who the character is, not what they do)
// ---------------------------------------------------------------

/**
 * A schema, not a straitjacket (plan §6). Authors write prose within these
 * fields, OR drop a free-form document into `freeform` to bypass the structure
 * entirely. Behavior emerges from identity, so these describe interiority.
 */
export interface SoulDocument {
  /** the one-line truth of who they are; essential self-concept */
  coreIdentity: string;
  /** what they want at a deep level — moving toward and away from */
  drives: string;
  /** what shaped them; what they protect; their fears */
  wounds: string;
  /** the lines they will and won't cross */
  values: string[];
  /** how they actually talk — rhythm, vocabulary, humor, sample lines */
  voice: string;
  /** how they treat people generally (per-user specifics live in Layer 3) */
  relationalStance: string;
  /** what they know and don't; the world they live in */
  knowledge: string;
  /** a defining contradiction — what makes them real rather than pleasant */
  contradiction: string;
  /** behavioral tells — what they do when frightened, moved, lying */
  tells: string;
  /** power-user override: when non-empty, used verbatim as the soul section */
  freeform?: string;
}

// ---------------------------------------------------------------
// Characters
// ---------------------------------------------------------------

export interface Character {
  id: ID;
  name: string;
  /** "Keeper of the lighthouse" — shown under the name */
  epithet: string;
  /** short third-person description for the Hall card */
  blurb: string;
  soul: SoulDocument;
  /** authored greeting; if empty, one is generated from soul + relationship */
  firstMessage: string;
  /** render the greeting with an illuminated drop-cap */
  greetingDropcap: boolean;
  /** main model for one-on-one depth, e.g. "gemma4:26b" */
  defaultModel: string;
  /** optional fast model for low-latency/ensemble, e.g. "gemma4:e4b" */
  fastModel: string | null;
  mood: Mood;
  status: CharacterStatus;
  /** optional portrait (absolute path or data URL); monogram if absent */
  avatarPath: string | null;
  /** surfaced as tags on the Hall card */
  traits: string[];
  /** a coarse voice preset that nudges tone ("Warm", "Measured", ...) */
  voicePreset: string;
  /** toggle Gemma 4's `<|think|>` for this character */
  thinking: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------
// Layer 4 — Lorebook (keyword/embedding-triggered context)
// ---------------------------------------------------------------

export type LoreScope = "character" | "relationship";

export interface LoreEntry {
  id: ID;
  scope: LoreScope;
  /** character_id when scope==="character", relationship_id when "relationship" */
  ownerId: ID;
  /** trigger keywords; entry fires only when one appears in recent conversation */
  keys: string[];
  content: string;
  enabled: boolean;
  caseSensitive: boolean;
  /** optional precomputed embedding for semantic triggering */
  embedding: number[] | null;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------
// Layer 2 — User & personas
// ---------------------------------------------------------------

/**
 * A persona generalizes the global user profile (plan §7). Most users have one
 * (the default); power users have several and pin them per relationship.
 */
export interface Persona {
  id: ID;
  userId: ID;
  /** how the user presents under this persona */
  name: string;
  /** the always-injected Layer 2 profile text */
  profile: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: ID;
  displayName: string;
  /** the persona used by default across relationships */
  defaultPersonaId: ID;
  createdAt: number;
}

// ---------------------------------------------------------------
// Layer 3 — Relationship (per user × character)
// ---------------------------------------------------------------

export type MemoryDepth = "session" | "season" | "everything";

export interface Relationship {
  id: ID;
  userId: ID;
  characterId: ID;
  /** Layer 3: the nature of this specific bond, history, asymmetric knowledge */
  profile: string;
  /** which persona the user presents here; null → user's default persona */
  personaId: ID | null;
  /** per-relationship model override; null → character/app default */
  modelOverride: string | null;
  memoryDepth: MemoryDepth;
  /** may the character reach out first (proactive presence) */
  proactiveAllowed: boolean;
  /** surface the character's inner monologue in chat */
  showInnerMonologue: boolean;
  /** may the character change the subject */
  allowTopicChange: boolean;
  /** lightweight carried emotional state */
  mood: Mood | null;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------
// Conversations & messages
// ---------------------------------------------------------------

export interface Conversation {
  id: ID;
  relationshipId: ID;
  title: string | null;
  /** Layer 5: the current situation/setting, if the conversation has a frame */
  sceneState: string | null;
  startedAt: number;
  updatedAt: number;
  /** rollup watermark: messages up to here are folded into summary memories */
  lastSummaryThroughMessageId: ID | null;
}

export interface Attachment {
  kind: "image";
  /** base64 (no `data:` prefix) for a multimodal model */
  data: string;
  mime: string;
}

export interface Message {
  id: ID;
  conversationId: ID;
  role: Role;
  content: string;
  attachments: Attachment[];
  /** estimated token count */
  tokens: number;
  createdAt: number;
  /** true once folded into a rollup summary memory */
  summarized: boolean;
}

// ---------------------------------------------------------------
// Memory (long-term, out-of-context, re-injected)
// ---------------------------------------------------------------

export type MemoryKind = "fact" | "event" | "preference" | "summary" | "tender";

export interface Memory {
  id: ID;
  relationshipId: ID;
  content: string;
  kind: MemoryKind;
  /** keyword triggers for non-embedding recall */
  keys: string[];
  embedding: number[] | null;
  /** 0..1 importance; higher survives pruning and ranks earlier */
  salience: number;
  sourceMessageIds: ID[];
  /** user-curated keep — never auto-pruned */
  pinned: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRecalledAt: number | null;
}

// ---------------------------------------------------------------
// Settings
// ---------------------------------------------------------------

export interface AppSettings {
  ollamaBaseUrl: string;
  /** main model for depth */
  defaultModel: string;
  /** fast model for low-latency / concurrency */
  fastModel: string;
  /** embedding model for semantic recall; "" disables embeddings */
  embeddingModel: string;
  /** managed context budget — NEVER leave at Ollama's silent 4K default */
  numCtx: number;
  temperature: number;
  /** use embeddings for memory/lore recall (falls back to keywords if off) */
  semanticRecall: boolean;
  /** summarize oldest in-context turns once history exceeds this token count */
  rollupThresholdTokens: number;
  /** how many of the most recent turns to always keep verbatim */
  recentVerbatimTurns: number;
  theme: "dark" | "light";
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaBaseUrl: "http://localhost:11434",
  defaultModel: "gemma4:26b",
  fastModel: "gemma4:e4b",
  embeddingModel: "nomic-embed-text",
  numCtx: 16384,
  temperature: 0.85,
  semanticRecall: true,
  rollupThresholdTokens: 6000,
  recentVerbatimTurns: 12,
  theme: "dark",
};

// ---------------------------------------------------------------
// Ollama wire types
// ---------------------------------------------------------------

export interface ChatMessage {
  role: Role;
  content: string;
  /** base64 images (no data: prefix) for multimodal turns */
  images?: string[];
}

export interface OllamaOptions {
  num_ctx?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  stop?: string[];
  [k: string]: unknown;
}

export interface OllamaChatRequest {
  model: string;
  messages: ChatMessage[];
  options?: OllamaOptions;
  stream?: boolean;
  keep_alive?: string | number;
  /** Ollama "think" flag (newer servers); we also support the `<|think|>` token */
  think?: boolean;
}

export interface OllamaChatChunk {
  model?: string;
  created_at?: string;
  message?: { role: Role; content: string; thinking?: string };
  done: boolean;
  done_reason?: string;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_count?: number;
  total_duration?: number;
}

export interface OllamaModelInfo {
  name: string;
  size?: number;
  details?: { parameter_size?: string; family?: string };
}

// ---------------------------------------------------------------
// Assembled context (output of the layered context assembler)
// ---------------------------------------------------------------

export interface BudgetReport {
  numCtx: number;
  systemTokens: number;
  historyTokens: number;
  /** tokens reserved for the model's reply */
  reserveTokens: number;
  /** how many older turns were dropped/summarized to fit */
  droppedTurns: number;
  withinBudget: boolean;
}

export interface AssembledContext {
  request: OllamaChatRequest;
  /** diagnostics, surfaced subtly in the UI ("she remembered…") */
  triggeredLore: LoreEntry[];
  recalledMemories: Memory[];
  budget: BudgetReport;
}
