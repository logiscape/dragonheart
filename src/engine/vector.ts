/* ============================================================
   Dragon Heart — vector utilities.
   Memory/lore semantic recall is a brute-force cosine search over
   a relationship's embeddings. At the scale of one relationship's
   memories (hundreds–low thousands) this is instant and avoids a
   native vector-index dependency.
   ============================================================ */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosineSim(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Rank `items` by cosine similarity of their embedding to `query`. Items whose
 * embedding is missing are skipped. Returns the top `k`, descending.
 */
export function topKBySimilarity<T>(
  items: T[],
  query: number[],
  getEmbedding: (item: T) => number[] | null | undefined,
  k: number,
  minScore = -Infinity,
): Array<Scored<T>> {
  const scored: Array<Scored<T>> = [];
  for (const item of items) {
    const emb = getEmbedding(item);
    if (!emb || emb.length === 0) continue;
    const score = cosineSim(query, emb);
    if (score >= minScore) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
