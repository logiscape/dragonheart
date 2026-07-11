import { describe, it, expect } from "vitest";
import {
  buildJudgeSchema,
  buildJudgeSystem,
  createOllamaRoomJudge,
  findMentionedSpeaker,
  findMentionedSpeakers,
  isDirectReply,
  renderJudgeTranscript,
  type RosterEntry,
} from "../roomJudge";
import { OllamaClient } from "../ollama";
import type { OllamaTransport } from "../ports";
import type { OllamaChatRequest } from "../types";

const ROSTER: RosterEntry[] = [
  { id: "char-elara", name: "Elara Vance", epithet: "Keeper of the lighthouse" },
  { id: "char-jax", name: "Jax Sterling", epithet: "Wandering tinker" },
  { id: "char-jaxon", name: "Jaxon Reed" },
];

describe("findMentionedSpeaker", () => {
  it("matches full names, first names, and @-mentions on word boundaries", () => {
    expect(findMentionedSpeaker("Elara, how's the lamp?", ROSTER)).toBe("char-elara");
    expect(findMentionedSpeaker("what say you, Elara Vance?", ROSTER)).toBe("char-elara");
    expect(findMentionedSpeaker("@Jax could you look at this", ROSTER)).toBe("char-jax");
  });

  it("does not let 'Jax' swallow 'Jaxon'", () => {
    expect(findMentionedSpeaker("Jaxon, you're quiet tonight", ROSTER)).toBe("char-jaxon");
    expect(findMentionedSpeaker("Jax, you're quiet tonight", ROSTER)).toBe("char-jax");
  });

  it("earliest mention wins; no mention returns null", () => {
    expect(findMentionedSpeaker("Jax and Elara should both hear this", ROSTER)).toBe("char-jax");
    expect(findMentionedSpeaker("what a night", ROSTER)).toBeNull();
  });

  it("returns every addressed participant in mention order", () => {
    expect(findMentionedSpeakers("Jax and Elara, what do you both think?", ROSTER)).toEqual([
      "char-jax",
      "char-elara",
    ]);
    expect(findMentionedSpeakers("Elara Vance, then @Jaxon, then Jax", ROSTER)).toEqual([
      "char-elara",
      "char-jaxon",
      "char-jax",
    ]);
    expect(findMentionedSpeakers("what a night", ROSTER)).toEqual([]);
    // each participant appears once even when named twice
    expect(findMentionedSpeakers("Jax? Jax Sterling, wake up!", ROSTER)).toEqual(["char-jax"]);
  });
});

describe("isDirectReply", () => {
  it("is true for a short answer to a character's question", () => {
    expect(isDirectReply("black, no sugar", { speakerId: "char-elara", endsWithQuestion: true })).toBe(
      true,
    );
  });
  it("is false without a question, without a character, or for long posts", () => {
    expect(isDirectReply("black, no sugar", { speakerId: "char-elara", endsWithQuestion: false })).toBe(
      false,
    );
    expect(isDirectReply("black, no sugar", { speakerId: null, endsWithQuestion: true })).toBe(false);
    expect(isDirectReply("x".repeat(200), { speakerId: "char-elara", endsWithQuestion: true })).toBe(
      false,
    );
    expect(isDirectReply("hello", null)).toBe(false);
  });
});

describe("judge prompt builders", () => {
  it("schema constrains speaker to the given options", () => {
    const s = buildJudgeSchema(["Elara Vance", "nobody"]) as any;
    expect(s.properties.speaker.enum).toEqual(["Elara Vance", "nobody"]);
  });
  it("system lists the roster with epithets", () => {
    const sys = buildJudgeSystem(ROSTER, "Robin");
    expect(sys).toContain("silent director");
    expect(sys).toContain("Elara Vance — Keeper of the lighthouse");
    expect(sys).toContain("Robin (the human)");
  });
  it("transcript is capped to the last 8 lines and long lines truncated", () => {
    const lines = Array.from({ length: 12 }, (_, i) => ({
      speaker: "Robin",
      text: i === 11 ? "y".repeat(500) : `line ${i}`,
    }));
    const out = renderJudgeTranscript(lines);
    expect(out).not.toContain("line 3");
    expect(out).toContain("line 4");
    expect(out).toContain("…");
  });
});

function judgeWith(reply: string) {
  const requests: OllamaChatRequest[] = [];
  const transport: OllamaTransport = {
    async chatStream(req, onChunk) {
      requests.push(req);
      onChunk({ message: { role: "assistant", content: reply }, done: true });
    },
    async post() {
      throw new Error("unused");
    },
    async get() {
      throw new Error("unused");
    },
  };
  const judge = createOllamaRoomJudge(new OllamaClient(transport), {
    model: "gemma4:26b",
    numCtx: 16384,
    roster: ROSTER,
    userName: "Robin",
    rng: () => 0.99, // deterministic shuffle
  });
  return { judge, requests };
}

describe("createOllamaRoomJudge", () => {
  it("maps the chosen name back to a character id", async () => {
    const { judge, requests } = judgeWith('{"speaker":"Elara Vance"}');
    const id = await judge.firstSpeaker("who wants tea?", []);
    expect(id).toBe("char-elara");
    const req = requests[0]!;
    expect(req.options?.temperature).toBe(0);
    expect(req.options?.num_ctx).toBe(16384);
    expect(req.think).toBe(false);
    expect((req.format as any).properties.speaker.enum).toContain("Jax Sterling");
  });

  it("follow-up excludes the previous speaker and offers nobody", async () => {
    const { judge, requests } = judgeWith('{"speaker":"nobody"}');
    const id = await judge.followUpSpeaker([], "char-elara");
    expect(id).toBeNull();
    const options = ((requests[0]!.format as any).properties.speaker.enum as string[]);
    expect(options).not.toContain("Elara Vance");
    expect(options).toContain("nobody");
  });

  it("returns null on garbage or transport failure", async () => {
    const { judge } = judgeWith("the moon is lovely tonight");
    expect(await judge.idleSpeaker([])).toBeNull();

    const broken = createOllamaRoomJudge(
      new OllamaClient({
        async chatStream() {
          throw new Error("ollama down");
        },
        async post() {
          throw new Error("x");
        },
        async get() {
          throw new Error("x");
        },
      }),
      { model: "m", numCtx: 8192, roster: ROSTER, userName: "Robin" },
    );
    expect(await broken.firstSpeaker("hello", [])).toBeNull();
  });
});
