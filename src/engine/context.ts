/* ============================================================
   Dragon Heart — the Layered Context Model (plan §4).
   Every turn, the system prompt is composed from distinct,
   independently-managed layers, then recent verbatim history is
   fit to a managed `num_ctx` budget. This is the thing that most
   distinguishes the app from "system prompt = personality" tools
   and pre-empts the "flat by message 30" failure.

     1 Soul Document      (per character, always)
       + voice examples   (few-shot cadence, when authored)
     2 Global user/persona(per user, always)
     3 Relationship       (per user × character: profile, time since
                           last spoke, carried affect, mood tint)
     4 Triggered lore + recalled memory (keyword/embedding-activated;
                           tender recall re-surfaces the character's tells)
     5 Scene / scenario   (per conversation, optional)
     6 Conversation history (recent verbatim within budget)
     7 Control tokens     (Gemma 4 <|think|>)
   ============================================================ */

import type {
  AppSettings,
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
import { normalizeSoul, soulToPrompt, voiceExamplesToPrompt } from "./soul";
import { estimateTokens, estimateMessageTokens } from "./tokens";

/** Present when assembling a turn inside a group room. */
export interface GroupAssembleInput {
  roomName: string;
  /** the character who is about to speak */
  selfCharacterId: string;
  /** everyone present, including the speaker */
  participants: Array<{ id: string; name: string; epithet?: string; blurb?: string }>;
}

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
  /** current time — enables "it's been three days" awareness when provided */
  now?: number;
  /** when the two of them last exchanged a message; null/absent → no gap line */
  lastInteractionAt?: number | null;
  /** set when this turn happens inside a group room */
  group?: GroupAssembleInput;
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

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Describe how long it's been since they last spoke, or null when the gap is
 * too small to matter (a character who announces "it's been ten minutes"
 * feels less human, not more).
 */
export function describeTimeGap(now: number, lastInteractionAt: number): string | null {
  const gap = now - lastInteractionAt;
  if (gap < 4 * HOUR_MS) return null;
  if (gap < 2 * DAY_MS) {
    const hours = Math.round(gap / HOUR_MS);
    return `about ${hours} hours`;
  }
  if (gap < 14 * DAY_MS) {
    const days = Math.round(gap / DAY_MS);
    return `about ${days} days`;
  }
  if (gap < 60 * DAY_MS) {
    const weeks = Math.round(gap / (7 * DAY_MS));
    return weeks <= 1 ? "about a week" : `about ${weeks} weeks`;
  }
  const months = Math.round(gap / (30 * DAY_MS));
  return months <= 1 ? "about a month" : `about ${months} months`;
}

function buildSystem(input: AssembleInput): string {
  const { character, persona, userName, relationship, conversation, triggeredLore, recalledMemories } =
    input;
  const blocks: string[] = [];

  // Layer 7 — control token first (Gemma 4 thinking toggle)
  const prefix = character.thinking ? "<|think|>\n" : "";

  // Layer 1 — Soul
  blocks.push(section("soul", soulToPrompt(character)));

  // Layer 1b — the voice in practice (few-shot cadence, not script)
  const voiceExamples = voiceExamplesToPrompt(character);
  if (voiceExamples) blocks.push(section("voice_examples", voiceExamples));

  // Layer 2 — Global user / persona
  const aboutLines: string[] = [];
  aboutLines.push(`The person you're with goes by "${userName || "they"}".`);
  if (persona && persona.profile.trim()) aboutLines.push(persona.profile.trim());
  blocks.push(section("about_user", aboutLines.join("\n")));

  // Layer 3 — Relationship
  const relLines: string[] = [];
  if (relationship.profile.trim()) relLines.push(relationship.profile.trim());
  if (input.now != null && input.lastInteractionAt != null) {
    const gap = describeTimeGap(input.now, input.lastInteractionAt);
    if (gap) {
      relLines.push(
        `It's been ${gap} since the two of you last spoke. Let that passage of time be real to you — don't announce it mechanically.`,
      );
    }
  }
  if (relationship.affect && relationship.affect.trim()) {
    relLines.push(
      `How the last conversation left you feeling (private — carry it, don't recite it): ${relationship.affect.trim()}`,
    );
  }
  if (relationship.mood && MOOD_HINT[relationship.mood]) relLines.push(MOOD_HINT[relationship.mood]!);
  if (relLines.length) blocks.push(section("relationship", relLines.join("\n")));

  // Layer 4 — Triggered lore + recalled memory
  const remembered: string[] = [];
  for (const m of recalledMemories) remembered.push(`• ${m.content}`);
  for (const l of triggeredLore) {
    if (l.content.trim()) remembered.push(l.content.trim());
  }
  if (remembered.length) {
    const rememberedLines = [
      "What you carry that's relevant right now (let it surface naturally, don't recite it):",
      remembered.join("\n"),
    ];
    // A tender memory near the surface should show in behavior, not narration.
    const tenderNearby = recalledMemories.some((m) => m.kind === "tender");
    const tells = normalizeSoul(character.soul).tells.trim();
    if (tenderNearby && tells) {
      rememberedLines.push(
        `Something tender is close to the surface right now. Don't name it unless they do — let it show through your tells: ${tells}`,
      );
    }
    blocks.push(section("remembered", rememberedLines.join("\n")));
  }

  // Layer 5 — Scene
  if (conversation.sceneState && conversation.sceneState.trim()) {
    blocks.push(section("scene", conversation.sceneState.trim()));
  }

  // Layer 5b — the room, when this turn happens in a gathering
  if (input.group) {
    const g = input.group;
    const others = g.participants.filter((p) => p.id !== g.selfCharacterId);
    const roomLines = [
      `You are in "${g.roomName}" — a shared space, not a private conversation.`,
      `Present with you:`,
      `- ${userName || "they"} — the human you all know.`,
      ...others.map((p) => `- ${p.name}${p.epithet ? ` — ${p.epithet}` : p.blurb ? ` — ${p.blurb}` : ""}`),
      `In the conversation, other people's words appear as "Name: their words".`,
      `You are ${character.name} and only ${character.name}. Speak in first person, as yourself. Never write dialogue or actions for ${userName || "them"} or the others — they speak for themselves. Do not prefix your reply with your own name. It's a shared fire: you may address anyone present, react to what others said, or stay brief when the moment isn't yours.`,
    ];
    blocks.push(section("room", roomLines.join("\n")));
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

/* ---------------- group history rendering ----------------
   From the speaking character's point of view: their own past turns stay
   unlabeled `assistant` turns (teaching by example that replies carry no
   name prefix); everyone else — the user and the other characters — becomes
   a labeled "Name: words" line in `user` role. Contiguous foreign lines are
   merged into one user message after budget fitting, preserving the
   user/model alternation Gemma expects. */

interface RenderedLine {
  role: "user" | "assistant";
  content: string;
  images: string[];
}

function renderGroupLine(
  m: Message,
  group: GroupAssembleInput,
  nameById: Map<string, string>,
  userName: string,
): RenderedLine {
  const images = m.attachments
    .filter((a): a is Attachment => a.kind === "image" && !!a.data)
    .map((a) => a.data);
  if (m.role === "assistant" && m.speakerCharacterId === group.selfCharacterId) {
    return { role: "assistant", content: m.content, images };
  }
  const label =
    m.role === "assistant"
      ? (m.speakerCharacterId && nameById.get(m.speakerCharacterId)) || "Someone"
      : userName || "They";
  return { role: "user", content: `${label}: ${m.content}`, images };
}

function mergeRenderedLines(lines: RenderedLine[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line.role === "user" && prev && prev.role === "user") {
      prev.content += `\n\n${line.content}`;
      if (line.images.length) prev.images = [...(prev.images ?? []), ...line.images];
    } else {
      const cm: ChatMessage = { role: line.role, content: line.content };
      if (line.images.length) cm.images = [...line.images];
      out.push(cm);
    }
  }
  return out;
}

/**
 * Strip a self-label the model copied from the transcript convention, and cut
 * the reply off where it starts speaking for someone else. Pure.
 */
export function sanitizeGroupReply(
  text: string,
  selfName: string,
  otherNames: string[],
): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = text.trim();
  const self = esc(selfName.trim());
  out = out.replace(new RegExp(`^\\s*\\**\\s*${self}\\s*\\**\\s*[:：]\\s*`, "i"), "");
  for (const name of otherNames) {
    const n = name.trim();
    if (!n) continue;
    const m = out.match(new RegExp(`^\\s*\\**\\s*${esc(n)}\\s*\\**\\s*[:：]`, "im"));
    if (m && m.index !== undefined) out = out.slice(0, m.index);
  }
  return out.trim();
}

/** Rooms pin every call to the one shared model — no per-character overrides. */
export function resolveRoomModel(settings: AppSettings): string {
  return settings.defaultModel;
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

  let messages: ChatMessage[];
  let historyTokens = 0;
  let dropped = 0;

  if (input.group) {
    // render every turn from the speaker's POV first (labels cost tokens),
    // fit on the rendered lines, then merge contiguous foreign lines
    const group = input.group;
    const nameById = new Map(group.participants.map((p) => [p.id, p.name]));
    const rendered = input.verbatim
      .filter((m) => m.role !== "system")
      .map((m) => renderGroupLine(m, group, nameById, input.userName));

    const kept: RenderedLine[] = [];
    for (let i = rendered.length - 1; i >= 0; i--) {
      const line = rendered[i]!;
      const cost = estimateMessageTokens({ content: line.content });
      if (historyTokens + cost <= available || kept.length === 0) {
        kept.push(line);
        historyTokens += cost;
      } else {
        dropped = i + 1;
        break;
      }
    }
    kept.reverse();
    if (newUserMsg) {
      // the new user message follows the same labeled convention in a room
      kept.push({
        role: "user",
        content: `${input.userName || "They"}: ${input.newUser!.content}`,
        images: newUserMsg.images ?? [],
      });
    }
    messages = mergeRenderedLines(kept);
  } else {
    // walk verbatim newest → oldest, keep what fits
    const kept: Message[] = [];
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
    messages = kept.map(toChatMessage);
    if (newUserMsg) messages.push(newUserMsg);
  }

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
