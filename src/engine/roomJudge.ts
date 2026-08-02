/* ============================================================
   Dragon Heart — the room's silent director.
   Decides who speaks next in a gathering. Heuristics first (a
   character addressed by name answers; a question gets answered by
   whoever asked the room) — those are free. Only genuinely ambiguous
   moments go to the model: a tiny, temperature-0, enum-constrained
   JSON call on the SAME model and num_ctx as chat, so the runner is
   never reloaded. A judge failure always degrades to "quiet", never
   to a wrong loud answer — except for the first response to the
   user, which must always happen (the orchestrator falls back).
   ============================================================ */

import type { OllamaClient } from "./ollama";
import { parseJsonLoose } from "./util";

export interface RosterEntry {
  id: string;
  name: string;
  epithet?: string;
  blurb?: string;
  /** 0..1 inclination to speak; 0.5 is neutral. Absent → neutral. */
  talkativeness?: number;
}

/** One rendered line of recent room history, oldest → newest. */
export interface TranscriptLine {
  speaker: string;
  text: string;
}

/** Who speaks next. Implementations resolve to a character id, or null. */
export interface RoomJudge {
  /** the first responder to a user message; null → caller falls back */
  firstSpeaker(userText: string, transcript: TranscriptLine[]): Promise<string | null>;
  /** whether anyone else chimes in; null = the moment is complete */
  followUpSpeaker(transcript: TranscriptLine[], excludeId: string): Promise<string | null>;
  /** who breaks a long silence; null → caller falls back. The last speaker
   *  stays eligible — sometimes pressing the moment further is the natural
   *  thing — but the judge is told who it was so someone else can stir. */
  idleSpeaker(transcript: TranscriptLine[], lastSpeakerId?: string | null): Promise<string | null>;
}

// ---------------------------------------------------------------
// Heuristics (pure)
// ---------------------------------------------------------------

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether the sentence continuing at `from` ends in a question mark. */
function sentenceAsksQuestion(text: string, from: number): boolean {
  const m = /[.!?…？！。\n]/.exec(text.slice(from));
  return m !== null && (m[0] === "?" || m[0] === "？");
}

/**
 * Find every participant addressed by name (`Elara`, `Elara Vance`, `@Elara`)
 * in the user's message. Whoever was asked a question answers first — "Don't
 * worry Elara! Jax, want a drink?" mentions Elara earlier, but the drink
 * question is Jax's to answer. Within each group, mention order holds —
 * "Jax and Elara, what do you both think?" names both in one question, Jax
 * first. All of them answer, in that order.
 */
export function findMentionedSpeakers(text: string, roster: RosterEntry[]): string[] {
  const hits: Array<{ id: string; index: number; asked: boolean }> = [];
  for (const entry of roster) {
    const full = entry.name.trim();
    const first = full.split(/\s+/)[0] ?? "";
    let bestIndex = Infinity;
    let asked = false;
    for (const name of [full, first]) {
      if (!name) continue;
      const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])@?${esc(name)}(?![\\p{L}\\p{N}])`, "igu");
      for (let m = re.exec(text); m !== null; m = re.exec(text)) {
        if (m.index < bestIndex) bestIndex = m.index;
        if (sentenceAsksQuestion(text, m.index + m[0].length)) asked = true;
      }
    }
    if (bestIndex < Infinity) hits.push({ id: entry.id, index: bestIndex, asked });
  }
  return hits
    .sort((a, b) => Number(b.asked) - Number(a.asked) || a.index - b.index)
    .map((h) => h.id);
}

/** The earliest-mentioned participant, if any. */
export function findMentionedSpeaker(text: string, roster: RosterEntry[]): string | null {
  return findMentionedSpeakers(text, roster)[0] ?? null;
}

/**
 * A short user message right after a character asked the room something is
 * almost certainly an answer to them.
 */
export function isDirectReply(
  userText: string,
  lastMessage: { speakerId: string | null; endsWithQuestion: boolean } | null,
): boolean {
  return (
    !!lastMessage?.speakerId && lastMessage.endsWithQuestion && userText.trim().length < 160
  );
}

// ---------------------------------------------------------------
// The model-backed judge
// ---------------------------------------------------------------

export const NOBODY = "nobody";

/** Enum-constrained schema: the model structurally cannot pick a non-option. */
export function buildJudgeSchema(options: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: { speaker: { type: "string", enum: options } },
    required: ["speaker"],
  };
}

const MAX_LINES = 8;
const MAX_LINE_CHARS = 240;

export function renderJudgeTranscript(transcript: TranscriptLine[]): string {
  return transcript
    .slice(-MAX_LINES)
    .map((l) => {
      const text = l.text.length > MAX_LINE_CHARS ? `${l.text.slice(0, MAX_LINE_CHARS)}…` : l.text;
      return `${l.speaker}: ${text}`;
    })
    .join("\n");
}

/** A temperament tag for the judge when talkativeness deviates from neutral. */
function temperament(t: number | undefined): string {
  if (t == null) return "";
  if (t <= 0.35) return " (usually quiet — speaks when it matters)";
  if (t >= 0.65) return " (talkative — quick to jump in)";
  return "";
}

export function buildJudgeSystem(roster: RosterEntry[], userName: string): string {
  const lines = roster.map(
    (r) =>
      `- ${r.name}${r.epithet ? ` — ${r.epithet}` : r.blurb ? ` — ${r.blurb}` : ""}${temperament(r.talkativeness)}`,
  );
  return `You are the silent director of a scene between friends. Present, besides ${userName} (the human):
${lines.join("\n")}
Read the recent conversation and answer with JSON only: {"speaker":"<name>"}.`;
}

export interface OllamaJudgeOptions {
  model: string;
  numCtx: number;
  roster: RosterEntry[];
  userName: string;
  /** injectable for tests; used only to shuffle enum order (de-biasing) */
  rng?: () => number;
}

/** Judge backed by a temperature-0, schema-constrained call on the chat model. */
export function createOllamaRoomJudge(client: OllamaClient, opts: OllamaJudgeOptions): RoomJudge {
  const rng = opts.rng ?? Math.random;
  const idByName = new Map(opts.roster.map((r) => [r.name.trim().toLowerCase(), r.id]));

  const shuffled = (names: string[]): string[] => {
    const out = [...names];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  async function ask(
    question: string,
    transcript: TranscriptLine[],
    options: string[],
  ): Promise<string | null> {
    try {
      const result = await client.chat({
        model: opts.model,
        messages: [
          { role: "system", content: buildJudgeSystem(opts.roster, opts.userName) },
          {
            role: "user",
            content: `${renderJudgeTranscript(transcript)}\n\n${question}\nAnswer with one of: ${options.join(", ")}.`,
          },
        ],
        // same model + same num_ctx as chat — the runner never reloads;
        // temperature 0 for a deterministic pick, thinking off for speed
        options: { num_ctx: opts.numCtx, temperature: 0 },
        stream: false,
        think: false,
        format: buildJudgeSchema(options),
      });
      const parsed = parseJsonLoose<{ speaker?: unknown }>(result.content);
      const name = typeof parsed?.speaker === "string" ? parsed.speaker.trim() : "";
      if (!name || name.toLowerCase() === NOBODY) return null;
      return idByName.get(name.toLowerCase()) ?? null;
    } catch {
      return null;
    }
  }

  return {
    firstSpeaker(userText, transcript) {
      const names = shuffled(opts.roster.map((r) => r.name));
      return ask(
        `${opts.userName} just said: "${userText.slice(0, MAX_LINE_CHARS)}". Who would naturally answer first?`,
        transcript,
        names,
      );
    },
    followUpSpeaker(transcript, excludeId) {
      const last = opts.roster.find((r) => r.id === excludeId);
      const names = shuffled(
        opts.roster.filter((r) => r.id !== excludeId).map((r) => r.name),
      );
      if (names.length === 0) return Promise.resolve(null);
      return ask(
        `${last?.name ?? "Someone"} just spoke. Would anyone else present naturally add something right now, or is the moment complete? Answer "${NOBODY}" if it is complete.`,
        transcript,
        [...names, NOBODY],
      );
    },
    idleSpeaker(transcript, lastSpeakerId) {
      const names = shuffled(opts.roster.map((r) => r.name));
      const last = lastSpeakerId ? opts.roster.find((r) => r.id === lastSpeakerId) : undefined;
      const question = last
        ? `The room has been quiet for a while. ${last.name} spoke last — they might press the moment further, or someone else might stir. Who would naturally break the silence?`
        : `The room has been quiet for a while. Who would naturally break the silence?`;
      return ask(question, transcript, names);
    },
  };
}
