/* ============================================================
   Dragon Heart — the Layered Context Model (plan §4).
   Every turn, the system prompt is composed from distinct,
   independently-managed layers, then recent verbatim history is
   fit to a managed `num_ctx` budget. This is the thing that most
   distinguishes the app from "system prompt = personality" tools
   and pre-empts the "flat by message 30" failure.

     1 Soul Document      (per character, always)
     2 Global user/persona(per user, always)
     3 Relationship       (per user × character)
     4 Triggered lore + recalled memory (keyword/embedding-activated)
     5 Scene / scenario   (per conversation, optional)
     6 Conversation history (recent verbatim within budget)
     7 Control tokens     (Gemma 4 <|think|>)
   ============================================================ */

import type {
  AssembledContext,
  Attachment,
  BudgetReport,
  ChatMessage,
  Character,
  Conversation,
  LoreEntry,
  Memory,
  Message,
  OllamaChatRequest,
  Persona,
  Relationship,
} from "./types";
import { soulToPrompt } from "./soul";
import { estimateTokens, estimateMessageTokens } from "./tokens";

export interface AssembleInput {
  numCtx: number;
  temperature: number;
  model: string;
  character: Character;
  persona: Persona | null;
  userName: string;
  relationship: Relationship;
  conversation: Conversation;
  /** recent, NOT-yet-summarized turns, oldest → newest, excluding the new user message */
  verbatim: Message[];
  /** the new user message to answer; null when generating a proactive/greeting turn */
  newUser: { content: string; attachments?: Attachment[] } | null;
  triggeredLore: LoreEntry[];
  recalledMemories: Memory[];
}

const MOOD_HINT: Record<string, string> = {
  ember: "Right now there's a warm, easy light between you.",
  heart: "Right now this feels tender, close to something that matters.",
  moss: "Right now things feel settled, growing, quietly hopeful.",
  arcane: "Right now there's a thoughtful, searching distance between you.",
};

function section(tag: string, body: string): string {
  return `<${tag}>\n${body.trim()}\n</${tag}>`;
}

function buildSystem(input: AssembleInput): string {
  const { character, persona, userName, relationship, conversation, triggeredLore, recalledMemories } =
    input;
  const blocks: string[] = [];

  // Layer 7 — control token first (Gemma 4 thinking toggle)
  const prefix = character.thinking ? "<|think|>\n" : "";

  // Layer 1 — Soul
  blocks.push(section("soul", soulToPrompt(character)));

  // Layer 2 — Global user / persona
  const aboutLines: string[] = [];
  aboutLines.push(`The person you're with goes by "${userName || "they"}".`);
  if (persona && persona.profile.trim()) aboutLines.push(persona.profile.trim());
  blocks.push(section("about_user", aboutLines.join("\n")));

  // Layer 3 — Relationship
  const relLines: string[] = [];
  if (relationship.profile.trim()) relLines.push(relationship.profile.trim());
  if (relationship.mood && MOOD_HINT[relationship.mood]) relLines.push(MOOD_HINT[relationship.mood]!);
  if (relLines.length) blocks.push(section("relationship", relLines.join("\n")));

  // Layer 4 — Triggered lore + recalled memory
  const remembered: string[] = [];
  for (const m of recalledMemories) remembered.push(`• ${m.content}`);
  for (const l of triggeredLore) {
    if (l.content.trim()) remembered.push(l.content.trim());
  }
  if (remembered.length) {
    blocks.push(
      section(
        "remembered",
        "What you carry that's relevant right now (let it surface naturally, don't recite it):\n" +
          remembered.join("\n"),
      ),
    );
  }

  // Layer 5 — Scene
  if (conversation.sceneState && conversation.sceneState.trim()) {
    blocks.push(section("scene", conversation.sceneState.trim()));
  }

  // Light behavioral nudges (kept minimal — identity, not task spec)
  const directives: string[] = [];
  if (!relationship.allowTopicChange) {
    directives.push("Follow their lead; don't steer the conversation elsewhere.");
  }
  if (character.voicePreset && character.voicePreset !== "Warm") {
    directives.push(`Your manner right now leans ${character.voicePreset.toLowerCase()}.`);
  }
  directives.push(
    "Write the way a person texts a close friend — natural length, no lists, no headings, no stage directions unless they fit your voice.",
  );
  blocks.push(section("how_to_be", directives.join(" ")));

  return prefix + blocks.join("\n\n");
}

function toChatMessage(m: Message): ChatMessage {
  const images = m.attachments
    .filter((a): a is Attachment => a.kind === "image" && !!a.data)
    .map((a) => a.data);
  const cm: ChatMessage = { role: m.role, content: m.content };
  if (images.length) cm.images = images;
  return cm;
}

/**
 * Compose the full Ollama chat request from the layers, fitting verbatim
 * history to the context budget (newest-first, dropping/relying-on-summary for
 * older turns).
 */
export function assembleContext(input: AssembleInput): AssembledContext {
  const system = buildSystem(input);
  const systemTokens = estimateTokens(system);

  const reserve = Math.min(2048, Math.max(512, Math.floor(input.numCtx * 0.25)));
  const newUserMsg: ChatMessage | null = input.newUser
    ? {
        role: "user",
        content: input.newUser.content,
        ...(input.newUser.attachments && input.newUser.attachments.some((a) => a.kind === "image")
          ? {
              images: input.newUser.attachments
                .filter((a) => a.kind === "image" && a.data)
                .map((a) => a.data),
            }
          : {}),
      }
    : null;

  const newUserTokens = newUserMsg ? estimateMessageTokens(newUserMsg) : 0;
  const available = input.numCtx - systemTokens - reserve - newUserTokens;

  // walk verbatim newest → oldest, keep what fits
  const kept: Message[] = [];
  let historyTokens = 0;
  let dropped = 0;
  for (let i = input.verbatim.length - 1; i >= 0; i--) {
    const m = input.verbatim[i]!;
    const cost = estimateMessageTokens(m);
    if (historyTokens + cost <= available || kept.length === 0) {
      kept.push(m);
      historyTokens += cost;
    } else {
      dropped = i + 1;
      break;
    }
  }
  kept.reverse();

  const messages: ChatMessage[] = kept.map(toChatMessage);
  if (newUserMsg) messages.push(newUserMsg);

  const totalHistory = historyTokens + newUserTokens;
  const budget: BudgetReport = {
    numCtx: input.numCtx,
    systemTokens,
    historyTokens: totalHistory,
    reserveTokens: reserve,
    droppedTurns: dropped,
    withinBudget: systemTokens + totalHistory + reserve <= input.numCtx,
  };

  const request: OllamaChatRequest = {
    model: input.model,
    messages: [{ role: "system", content: system }, ...messages],
    options: { num_ctx: input.numCtx, temperature: input.temperature },
    stream: true,
    think: input.character.thinking,
    keep_alive: "10m",
  };

  return {
    request,
    triggeredLore: input.triggeredLore,
    recalledMemories: input.recalledMemories,
    budget,
  };
}

/** Resolve which model a turn should use. */
export function resolveModel(
  relationship: Relationship,
  character: Character,
  fallback: string,
): string {
  return relationship.modelOverride || character.defaultModel || fallback;
}
