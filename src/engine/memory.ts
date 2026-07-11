/* ============================================================
   Dragon Heart — long-term memory (plan §5).
   Two complementary mechanisms, both using the local model:
   - Summarization rollup: distill the oldest in-context turns into
     durable memories, freeing the window while preserving substance.
   - Triggered recall: rank stored memories by relevance + salience +
     recency so the character "remembers something from weeks ago
     because it's relevant now" — the biggest contributor to the
     feeling of a real relationship.
   Memories are inspectable & editable by the user (correctness > warmth
   when a memory is wrong), so extraction only proposes; the user curates.
   ============================================================ */

import type { OllamaClient } from "./ollama";
import type { Memory, MemoryKind, Message } from "./types";
import { cosineSim } from "./vector";
import { clamp, parseJsonLoose } from "./util";

export interface MemoryCandidate {
  content: string;
  kind: MemoryKind;
  keys: string[];
  salience: number;
  sourceMessageIds: string[];
}

const VALID_KINDS: MemoryKind[] = ["fact", "event", "preference", "summary", "tender"];

function coerceKind(k: unknown): MemoryKind {
  return VALID_KINDS.includes(k as MemoryKind) ? (k as MemoryKind) : "fact";
}

/** Render messages as a plain transcript for the extraction model. */
export function formatTranscript(
  messages: Message[],
  characterName: string,
  userName: string,
): string {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const who = m.role === "assistant" ? characterName : userName;
      return `${who}: ${m.content}`;
    })
    .join("\n");
}

const EXTRACT_SYSTEM = `You maintain the long-term memory of a character in an ongoing relationship with a user. From the transcript, extract durable things the character should remember about the user and their bond — facts, events, preferences, and emotionally weighty moments. Ignore small talk and anything ephemeral.

Return ONLY JSON of this exact shape:
{"memories":[{"content":"<short third-person note the character would keep>","kind":"fact|event|preference|tender","keys":["<1-4 lowercase trigger keywords>"],"salience":<0.0-1.0 importance>}]}

Rules:
- content is concise and written from the character's perspective ("User's sister is getting married in autumn").
- "tender" is for emotionally significant, fragile things.
- salience: 0.9+ only for life-shaping things; 0.3-0.6 for ordinary facts.
- If nothing is worth keeping, return {"memories":[]}.`;

function parseCandidates(raw: string, sourceIds: string[]): MemoryCandidate[] {
  const parsed = parseJsonLoose<{ memories?: unknown[] }>(raw);
  const list = Array.isArray(parsed?.memories) ? parsed!.memories : [];
  const out: MemoryCandidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (!content) continue;
    const keys = Array.isArray(o.keys)
      ? o.keys.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean)
      : [];
    const salience = clamp(typeof o.salience === "number" ? o.salience : 0.5, 0, 1);
    out.push({ content, kind: coerceKind(o.kind), keys, salience, sourceMessageIds: sourceIds });
  }
  return out;
}

/** Extract memory candidates from a slice of messages (does not persist). */
export async function extractMemories(
  client: OllamaClient,
  model: string,
  messages: Message[],
  characterName: string,
  userName: string,
): Promise<MemoryCandidate[]> {
  if (messages.length === 0) return [];
  const transcript = formatTranscript(messages, characterName, userName);
  const result = await client.chat({
    model,
    messages: [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: transcript },
    ],
    options: { temperature: 0.2 },
    stream: false,
  });
  return parseCandidates(result.content, messages.map((m) => m.id));
}

const ROLLUP_SYSTEM = `You compress the oldest part of a conversation into memory so it can leave the live context without being lost. Produce a faithful, compact summary AND pull out the salient durable facts.

Return ONLY JSON:
{"summary":"<a compact paragraph capturing what happened and what matters>","facts":[{"content":"<durable note>","kind":"fact|event|preference|tender","keys":["<keywords>"],"salience":<0.0-1.0>}]}`;

/**
 * Summarize the oldest turns into one summary memory plus extracted facts.
 * Caller persists the results and marks the source messages summarized.
 */
export async function summarizeRollup(
  client: OllamaClient,
  model: string,
  messages: Message[],
  characterName: string,
  userName: string,
): Promise<{ summary: MemoryCandidate | null; facts: MemoryCandidate[] }> {
  if (messages.length === 0) return { summary: null, facts: [] };
  const transcript = formatTranscript(messages, characterName, userName);
  const sourceIds = messages.map((m) => m.id);
  const result = await client.chat({
    model,
    messages: [
      { role: "system", content: ROLLUP_SYSTEM },
      { role: "user", content: transcript },
    ],
    options: { temperature: 0.2 },
    stream: false,
  });
  const parsed = parseJsonLoose<{ summary?: unknown; facts?: unknown[] }>(result.content);
  const summaryText = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  const summary: MemoryCandidate | null = summaryText
    ? { content: summaryText, kind: "summary", keys: [], salience: 0.55, sourceMessageIds: sourceIds }
    : null;
  const facts = parseCandidates(
    JSON.stringify({ memories: Array.isArray(parsed?.facts) ? parsed!.facts : [] }),
    sourceIds,
  );
  return { summary, facts };
}

// ---------------------------------------------------------------
// Group rooms — speaker-labeled transcripts & tagged rollup
// ---------------------------------------------------------------

export interface GroupSpeaker {
  id: string;
  name: string;
}

/** A fact plus which participants keep it as their own memory. */
export interface TaggedMemoryCandidate extends MemoryCandidate {
  retainedByIds: string[];
}

/**
 * Render a room slice as a speaker-labeled transcript. Assistant turns resolve
 * their speaker by id (departed/unknown speakers become "Someone"); user turns
 * are the human.
 */
export function formatGroupTranscript(
  messages: Message[],
  speakers: GroupSpeaker[],
  userName: string,
): string {
  const nameById = new Map(speakers.map((s) => [s.id, s.name]));
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const who =
        m.role === "assistant"
          ? (m.speakerCharacterId && nameById.get(m.speakerCharacterId)) || "Someone"
          : userName;
      return `${who}: ${m.content}`;
    })
    .join("\n");
}

/**
 * JSON Schema for the tagged group rollup, passed as OllamaChatRequest.format.
 * `retainedBy` is an enum of participant NAMES — names are what the model sees
 * in the transcript; resolution back to ids happens in parsing.
 */
export function buildGroupRollupFormat(participantNames: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      facts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: { type: "string" },
            kind: { type: "string", enum: ["fact", "event", "preference", "tender"] },
            keys: { type: "array", items: { type: "string" }, maxItems: 4 },
            salience: { type: "number", minimum: 0, maximum: 1 },
            retainedBy: {
              type: "array",
              items: { type: "string", enum: participantNames },
              minItems: 1,
            },
          },
          required: ["content", "kind", "keys", "salience", "retainedBy"],
        },
      },
    },
    required: ["summary", "facts"],
  };
}

function groupRollupSystem(names: string[], userName: string): string {
  const list = names.join(", ");
  return `You compress the oldest part of a group conversation into memory so it can leave the live context without being lost. The characters present are: ${list}. The human with them is ${userName}. Produce a faithful, compact summary of what happened in the room, AND pull out the durable facts worth remembering.

For each fact, "retainedBy" lists which of the characters (${list}) were present and engaged for it and would carry it as their own memory. Something said openly to the whole room is retained by everyone; a private aside only by whom it touched.

Return ONLY JSON:
{"summary":"<a compact paragraph capturing what happened and what matters>","facts":[{"content":"<short third-person durable note, e.g. \\"${userName}'s sister is getting married in autumn\\">","kind":"fact|event|preference|tender","keys":["<1-4 lowercase trigger keywords>"],"salience":<0.0-1.0>,"retainedBy":["<character name>"]}]}

Rules:
- "tender" is for emotionally significant, fragile things.
- salience: 0.9+ only for life-shaping things; 0.3-0.6 for ordinary facts.
- If nothing durable happened, return an empty facts array.`;
}

/**
 * Resolve retainedBy names → participant ids (case-insensitive; first-name
 * matches allowed). Unknown names are dropped; facts retained by nobody are
 * dropped entirely — a wrong memory is worse than a forgotten one.
 */
function parseTaggedFacts(
  rawFacts: unknown[],
  speakers: GroupSpeaker[],
  sourceIds: string[],
): TaggedMemoryCandidate[] {
  const idByKey = new Map<string, string>();
  for (const s of speakers) {
    const full = s.name.trim().toLowerCase();
    if (full && !idByKey.has(full)) idByKey.set(full, s.id);
    const first = full.split(/\s+/)[0];
    if (first && !idByKey.has(first)) idByKey.set(first, s.id);
  }
  const out: TaggedMemoryCandidate[] = [];
  for (const item of rawFacts) {
    // parse one at a time so a skipped (empty) fact can't shift the pairing
    // between candidate and its retainedBy tags
    const candidate = parseCandidates(JSON.stringify({ memories: [item] }), sourceIds)[0];
    if (!candidate) continue;
    const o = item as Record<string, unknown>;
    const names = Array.isArray(o.retainedBy)
      ? o.retainedBy.filter((n): n is string => typeof n === "string")
      : [];
    const ids = [
      ...new Set(
        names
          .map((n) => idByKey.get(n.trim().toLowerCase()))
          .filter((id): id is string => !!id),
      ),
    ];
    if (ids.length === 0) continue;
    out.push({ ...candidate, retainedByIds: ids });
  }
  return out;
}

/**
 * Group-room rollup: one pass over the speaker-labeled transcript, producing a
 * room-scoped summary plus facts tagged with who retains them. Runs on the
 * room's chat model with the room's num_ctx (never a second model — no swaps).
 */
export async function summarizeGroupRollup(
  client: OllamaClient,
  model: string,
  numCtx: number,
  messages: Message[],
  participants: GroupSpeaker[],
  userName: string,
): Promise<{ summary: MemoryCandidate | null; facts: TaggedMemoryCandidate[] }> {
  if (messages.length === 0) return { summary: null, facts: [] };
  const names = participants.map((p) => p.name);
  const transcript = formatGroupTranscript(messages, participants, userName);
  const sourceIds = messages.map((m) => m.id);
  const result = await client.chat({
    model,
    messages: [
      { role: "system", content: groupRollupSystem(names, userName) },
      { role: "user", content: transcript },
    ],
    // match the chat calls so Ollama reuses the loaded runner
    options: { num_ctx: numCtx, temperature: 0.2 },
    stream: false,
    think: false,
    format: buildGroupRollupFormat(names),
  });
  const parsed = parseJsonLoose<{ summary?: unknown; facts?: unknown[] }>(result.content);
  const summaryText = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  const summary: MemoryCandidate | null = summaryText
    ? { content: summaryText, kind: "summary", keys: [], salience: 0.55, sourceMessageIds: sourceIds }
    : null;
  const facts = parseTaggedFacts(
    Array.isArray(parsed?.facts) ? parsed!.facts : [],
    participants,
    sourceIds,
  );
  return { summary, facts };
}

// ---------------------------------------------------------------
// Recall ranking
// ---------------------------------------------------------------

const DAY_MS = 86_400_000;

function keywordOverlap(memory: Memory, text: string): number {
  if (memory.keys.length === 0) return 0;
  const h = text.toLowerCase();
  let hits = 0;
  for (const k of memory.keys) {
    if (k && h.includes(k.toLowerCase())) hits++;
  }
  return hits / memory.keys.length;
}

export interface RecallOptions {
  queryEmbedding?: number[] | null;
  recentText: string;
  now: number;
  k: number;
  /** minimum combined score to surface a memory */
  minScore?: number;
}

/**
 * Rank memories for recall. Combines semantic (or keyword) relevance with
 * salience and a gentle recency boost; pinned memories get a lift. Pure.
 */
export function rankMemoriesForRecall(memories: Memory[], opts: RecallOptions): Memory[] {
  const { queryEmbedding = null, recentText, now, k, minScore = 0.15 } = opts;
  const scored: Array<{ m: Memory; score: number }> = [];

  for (const m of memories) {
    if (!m.enabled) continue;

    let relevance = 0;
    if (queryEmbedding && m.embedding) {
      relevance = Math.max(0, cosineSim(queryEmbedding, m.embedding));
    } else {
      relevance = keywordOverlap(m, recentText);
    }

    const ageDays = Math.max(0, (now - m.createdAt) / DAY_MS);
    const recency = 1 / (1 + ageDays / 30); // ~half-weight after a month
    const pinBoost = m.pinned ? 0.25 : 0;

    const score = 0.6 * relevance + 0.25 * m.salience + 0.15 * recency + pinBoost;
    scored.push({ m, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score >= minScore || s.m.pinned)
    .slice(0, k)
    .map((s) => s.m);
}

/** Whether accumulated in-context history warrants a rollup pass. */
export function shouldRollup(historyTokens: number, thresholdTokens: number): boolean {
  return historyTokens > thresholdTokens;
}
