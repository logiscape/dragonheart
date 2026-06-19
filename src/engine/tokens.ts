/* ============================================================
   Dragon Heart — token estimation.
   We don't ship a tokenizer; for budgeting the context window a
   cheap, slightly-conservative char heuristic is enough. The real
   guardrail is `num_ctx` plus a generous reply reserve.
   ============================================================ */

import type { ChatMessage } from "./types";

/** ~4 characters per token is a reasonable cross-model heuristic for prose. */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** A chat message costs its content plus a little role/delimiter overhead. */
export function estimateMessageTokens(msg: Pick<ChatMessage, "content">): number {
  return estimateTokens(msg.content) + 4;
}

export function estimateMessagesTokens(msgs: Array<Pick<ChatMessage, "content">>): number {
  let total = 0;
  for (const m of msgs) total += estimateMessageTokens(m);
  return total;
}
