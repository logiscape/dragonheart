/* ============================================================
   Dragon Heart — @-mention helpers for the room composer.
   Pure text logic (no React, no DOM) so it stays unit-testable:
   detect the token being typed at the caret, match it against
   the roster, and splice the chosen name back in. The engine
   already understands "@Elara Vance" (findMentionedSpeakers) —
   this is only the familiar Discord-style picker on top.
   ============================================================ */

export interface MentionToken {
  /** index of the "@" in the text */
  start: number;
  /** what's been typed after the "@", up to the caret */
  query: string;
}

/**
 * The mention being typed at the caret, or null. An "@" opens a token only at
 * the start of a word — "user@host" is an email, not a mention — and the token
 * dies at a newline, another "@", or a leading space after the "@".
 */
export function findMentionToken(text: string, caret: number): MentionToken | null {
  const upto = text.slice(0, Math.max(0, caret));
  const at = upto.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[\p{L}\p{N}]/u.test(upto[at - 1]!)) return null;
  const query = upto.slice(at + 1);
  if (/^\s/.test(query) || query.includes("\n")) return null;
  return { start: at, query };
}

/** Case-insensitive prefix match on the full name or any word of it. */
export function mentionMatches(query: string, name: string): boolean {
  const q = query.toLowerCase();
  if (!q) return true;
  const n = name.toLowerCase();
  return n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q));
}

/** Replace the token with a canonical "@Full Name " and give the new caret. */
export function applyMention(
  text: string,
  caret: number,
  token: MentionToken,
  name: string,
): { text: string; caret: number } {
  const before = text.slice(0, token.start);
  let end = Math.max(caret, token.start);
  // caret parked inside an already-typed mention ("@Ela|ra Vance", "@Van|ce")?
  // the query may have been typing the full name or any word of it — absorb
  // whichever continuation is already typed past the caret, so completing
  // doesn't duplicate it
  const lowerName = name.toLowerCase();
  const lowerQuery = token.query.toLowerCase();
  const continuations: string[] = [];
  if (lowerName.startsWith(lowerQuery)) continuations.push(lowerName.slice(lowerQuery.length));
  for (const word of lowerName.split(/\s+/)) {
    if (word.startsWith(lowerQuery)) continuations.push(word.slice(lowerQuery.length));
  }
  let absorbed = 0;
  for (const cont of continuations) {
    let i = 0;
    while (i < cont.length && end + i < text.length && text[end + i]!.toLowerCase() === cont[i]!) {
      i++;
    }
    if (i > absorbed) absorbed = i;
  }
  end += absorbed;
  const rest = text.slice(end);
  // the trailing space keeps typing flowing, but never double up on one
  const inserted = /^\s/.test(rest) ? `@${name}` : `@${name} `;
  const next = before + inserted + rest;
  return { text: next, caret: before.length + inserted.length };
}
