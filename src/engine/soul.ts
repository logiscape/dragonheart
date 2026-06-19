/* ============================================================
   Dragon Heart — Soul Document rendering (Layer 1).
   Turns a character's interior identity into the always-present
   system section. Describes WHO they are, from which behavior
   emerges — never a task spec (plan §6). A free-form override is
   used verbatim when an author wants full control.
   ============================================================ */

import type { Character, SoulDocument } from "./types";
import { estimateTokens } from "./tokens";

export function blankSoul(): SoulDocument {
  return {
    coreIdentity: "",
    drives: "",
    wounds: "",
    values: [],
    voice: "",
    relationalStance: "",
    knowledge: "",
    contradiction: "",
    tells: "",
    freeform: "",
  };
}

/** Is the soul substantive enough to drive a character? Used by authoring UX. */
export function soulIsAuthored(soul: SoulDocument): boolean {
  if (soul.freeform && soul.freeform.trim().length > 40) return true;
  return Boolean(
    soul.coreIdentity.trim() ||
      soul.drives.trim() ||
      soul.wounds.trim() ||
      soul.voice.trim(),
  );
}

/** Render the <soul> section of the system prompt. */
export function soulToPrompt(char: Character): string {
  const s = char.soul;
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
  section("How you treat people", s.relationalStance);
  section("The world you know", s.knowledge);
  section("A contradiction you carry", s.contradiction);
  section("Your tells", s.tells);

  lines.push(
    "\nSpeak and act from this identity. You are this person, not an assistant; never break character, never mention being an AI or a model. Let your behavior emerge from who you are.",
  );
  return lines.join("\n");
}

export function soulTokenEstimate(char: Character): number {
  return estimateTokens(soulToPrompt(char));
}
