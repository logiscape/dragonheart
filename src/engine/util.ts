/* ============================================================
   Dragon Heart — small shared utilities.
   ============================================================ */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Parse a JSON column value with a fallback (DB stores arrays/objects as text). */
export function safeJsonParse<T>(text: unknown, fallback: T): T {
  if (typeof text !== "string") return (text as T) ?? fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/**
 * Best-effort parse of model output that should be JSON but may be wrapped in
 * prose or code fences. Finds the first balanced object/array and parses it.
 */
export function parseJsonLoose<T = unknown>(text: string | null | undefined): T | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    /* fall through to balanced scan */
  }
  const start = t.search(/[[{]/);
  if (start === -1) return null;
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(t.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Lowercase, collapse whitespace — for cheap keyword/relevance comparison. */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Distinct, non-empty, trimmed strings preserving order. */
export function uniqueStrings(arr: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = (raw ?? "").trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
