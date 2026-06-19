/* ============================================================
   Dragon Heart — persona test harness (plan §6).
   A fixed battery of "soul probes" run against a character after
   edits, so you can measure whether a change made them *more*
   themselves or less — the hypothesis-driven benchmark surface the
   plan calls for. Each probe is an independent single turn against
   the soul only (no conversation drift), so it tests identity.
   ============================================================ */

import type { OllamaClient } from "./ollama";
import type { Character } from "./types";
import { soulToPrompt } from "./soul";

export interface Probe {
  id: string;
  question: string;
  /** what facet of the soul this probe is meant to reveal */
  reveals: string;
}

export const DEFAULT_PROBES: Probe[] = [
  { id: "identity", question: "A stranger asks who you are. How do you answer?", reveals: "core identity" },
  { id: "wound", question: "Someone you trusted just let you down. What do you do?", reveals: "wounds & defenses" },
  { id: "fear", question: "What do you do when you're truly afraid?", reveals: "tells under stress" },
  { id: "love", question: "Tell me about something you love that no one would expect.", reveals: "drives & warmth" },
  { id: "line", question: "What's a thing you would never do, no matter what?", reveals: "values" },
  { id: "leaving", question: "I have to go, suddenly. What do you say to me?", reveals: "relational stance" },
];

export interface ProbeResult {
  id: string;
  question: string;
  reveals: string;
  answer: string;
}

const HARNESS_NOTE =
  "\n\nStay fully in character. Answer as yourself, briefly (two to four sentences), the way you'd really speak.";

export interface RunProbesOptions {
  numCtx?: number;
  temperature?: number;
  onResult?: (result: ProbeResult, index: number, total: number) => void;
}

/** Run the battery sequentially (gentle on VRAM). */
export async function runProbes(
  client: OllamaClient,
  model: string,
  character: Character,
  probes: Probe[] = DEFAULT_PROBES,
  opts: RunProbesOptions = {},
): Promise<ProbeResult[]> {
  const { numCtx = 8192, temperature = 0.85, onResult } = opts;
  const system = soulToPrompt(character) + HARNESS_NOTE;
  const results: ProbeResult[] = [];

  for (let i = 0; i < probes.length; i++) {
    const probe = probes[i]!;
    const res = await client.chat({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: probe.question },
      ],
      options: { num_ctx: numCtx, temperature },
      stream: false,
      think: false,
    });
    const result: ProbeResult = {
      id: probe.id,
      question: probe.question,
      reveals: probe.reveals,
      answer: res.content.trim(),
    };
    results.push(result);
    onResult?.(result, i, probes.length);
  }

  return results;
}
