/* ============================================================
   Dragon Heart — Lorebook triggering (Layer 4).
   The fix for SillyTavern's "flat by message 30": instead of
   front-loading everything, lore entries fire into context only
   when their keywords appear (or, with embeddings on, when they're
   semantically relevant to what's being discussed).
   ============================================================ */

import type { LoreEntry } from "./types";
import { cosineSim } from "./vector";

export interface LoreHit {
  entry: LoreEntry;
  reason: "keyword" | "semantic";
  score: number;
}

function keyAppears(key: string, haystack: string, caseSensitive: boolean): boolean {
  const k = (caseSensitive ? key : key.toLowerCase()).trim();
  if (!k) return false;
  const h = caseSensitive ? haystack : haystack.toLowerCase();
  return h.includes(k);
}

/** Pure keyword trigger — used standalone and as the first pass of triggerLore. */
export function triggerByKeyword(entries: LoreEntry[], text: string): LoreEntry[] {
  const out: LoreEntry[] = [];
  for (const e of entries) {
    if (!e.enabled) continue;
    if (e.keys.some((k) => keyAppears(k, text, e.caseSensitive))) out.push(e);
  }
  return out;
}

/**
 * Trigger lore by keyword first (authoritative), then fill remaining slots with
 * semantically-relevant entries when a query embedding is available.
 */
export function triggerLore(
  entries: LoreEntry[],
  recentText: string,
  opts: {
    queryEmbedding?: number[] | null;
    semanticThreshold?: number;
    maxEntries?: number;
  } = {},
): LoreHit[] {
  const { queryEmbedding = null, semanticThreshold = 0.55, maxEntries = 8 } = opts;
  const byId = new Map<string, LoreHit>();

  for (const e of entries) {
    if (!e.enabled) continue;
    if (e.keys.some((k) => keyAppears(k, recentText, e.caseSensitive))) {
      byId.set(e.id, { entry: e, reason: "keyword", score: 1 });
    }
  }

  if (queryEmbedding) {
    for (const e of entries) {
      if (!e.enabled || byId.has(e.id) || !e.embedding) continue;
      const score = cosineSim(queryEmbedding, e.embedding);
      if (score >= semanticThreshold) {
        byId.set(e.id, { entry: e, reason: "semantic", score });
      }
    }
  }

  const hits = [...byId.values()];
  // keyword hits (score 1) naturally rank above semantic; ties by score
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxEntries);
}
