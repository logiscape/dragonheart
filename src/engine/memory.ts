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
