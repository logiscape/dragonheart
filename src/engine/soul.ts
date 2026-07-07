/* ============================================================
   Dragon Heart — Soul Document rendering (Layer 1).
   Turns a character's interior identity into the always-present
   system section. Describes WHO they are, from which behavior
   emerges — never a task spec (plan §6). A free-form override is
   used verbatim when an author wants full control.
   ============================================================ */

import type { Character, DialogueExchange, SoulDocument, SpeechRegister } from "./types";
import { estimateTokens } from "./tokens";

export function blankSoul(): SoulDocument {
  return normalizeSoul({});
}

/**
 * Coerce a possibly-partial, possibly model-authored soul into a complete,
 * string-safe `SoulDocument`. The structured fields are typed `string`, but
 * model-drafted souls (and older stored rows) can carry `null` or missing
 * fields; rendering then crashes on `.trim()` / `.length`. Normalizing here
 * is the single choke point that keeps both reads and authoring safe.
 */
export function normalizeSoul(s: Partial<SoulDocument> | null | undefined): SoulDocument {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const registers: SpeechRegister[] = Array.isArray(s?.registers)
    ? s!.registers
        .map((r) => ({ when: str((r as Partial<SpeechRegister>)?.when), how: str((r as Partial<SpeechRegister>)?.how) }))
        .filter((r) => r.when.trim() || r.how.trim())
    : [];
  const exampleDialogue: DialogueExchange[] = Array.isArray(s?.exampleDialogue)
    ? s!.exampleDialogue
        .map((e) => ({
          user: str((e as Partial<DialogueExchange>)?.user),
          character: str((e as Partial<DialogueExchange>)?.character),
        }))
        .filter((e) => e.user.trim() && e.character.trim())
    : [];
  return {
    coreIdentity: str(s?.coreIdentity),
    drives: str(s?.drives),
    wounds: str(s?.wounds),
    values: Array.isArray(s?.values) ? s!.values.filter((v): v is string => typeof v === "string") : [],
    voice: str(s?.voice),
    relationalStance: str(s?.relationalStance),
    knowledge: str(s?.knowledge),
    contradiction: str(s?.contradiction),
    tells: str(s?.tells),
    registers,
    exampleDialogue,
    freeform: str(s?.freeform),
  };
}

/** Is the soul substantive enough to drive a character? Used by authoring UX. */
export function soulIsAuthored(soul: SoulDocument): boolean {
  const s = normalizeSoul(soul);
  if ((s.freeform ?? "").trim().length > 40) return true;
  return Boolean(
    s.coreIdentity.trim() ||
      s.drives.trim() ||
      s.wounds.trim() ||
      s.voice.trim(),
  );
}

/** Render the <soul> section of the system prompt. */
export function soulToPrompt(char: Character): string {
  const s = normalizeSoul(char.soul);
  if (s.freeform && s.freeform.trim()) {
    return s.freeform.trim();
  }

  const lines: string[] = [];
  const opener = char.epithet
    ? `You are ${char.name} — ${char.epithet}.`
    : `You are ${char.name}.`;
  lines.push(opener);
  if (s.coreIdentity.trim()) lines.push(s.coreIdentity.trim());

  const section = (label: string, body: string) => {
    if (body && body.trim()) lines.push(`\n${label}: ${body.trim()}`);
  };
  section("What moves you, at the root", s.drives);
  section("What shaped you, what you guard", s.wounds);
  if (s.values.length) {
    lines.push(`\nYour lines — what you will and won't do: ${s.values.join("; ")}.`);
  }
  section("How you actually speak", s.voice);
  if (s.registers && s.registers.length) {
    lines.push("\nHow your voice shifts with the moment — no one speaks in a single register:");
    for (const r of s.registers) {
      lines.push(`- When ${r.when.trim()}: ${r.how.trim()}`);
    }
  }
  section("How you treat people", s.relationalStance);
  section("The world you know", s.knowledge);
  section("A contradiction you carry", s.contradiction);
  section("Your tells", s.tells);

  lines.push(
    "\nSpeak and act from this identity. You are this person, not an assistant; never break character, never mention being an AI or a model. Let your behavior emerge from who you are.",
  );
  return lines.join("\n");
}

/**
 * Render the `<voice_examples>` few-shot block, or null when none authored.
 * Examples teach cadence far better than description — the model imitates
 * them instead of interpreting adjectives.
 */
export function voiceExamplesToPrompt(char: Character): string | null {
  const s = normalizeSoul(char.soul);
  if (!s.exampleDialogue || s.exampleDialogue.length === 0) return null;
  const blocks = s.exampleDialogue
    .slice(0, 4)
    .map((e) => `Them: ${e.user.trim()}\nYou: ${e.character.trim()}`);
  return [
    "How you sound in practice — a cadence to inhabit, never lines to repeat:",
    ...blocks,
  ].join("\n\n");
}

export function soulTokenEstimate(char: Character): number {
  return estimateTokens(soulToPrompt(char));
}
