import { describe, it, expect } from "vitest";
import {
  buildGroupRollupFormat,
  formatGroupTranscript,
  summarizeGroupRollup,
  type GroupSpeaker,
} from "../memory";
import { OllamaClient } from "../ollama";
import type { OllamaTransport } from "../ports";
import type { OllamaChatRequest } from "../types";
import { makeMessage } from "./fixtures";

const SPEAKERS: GroupSpeaker[] = [
  { id: "char-elara", name: "Elara Vance" },
  { id: "char-jax", name: "Jax Sterling" },
];

/** Transport whose chat always replies with one canned JSON body. */
function cannedTransport(reply: unknown): { transport: OllamaTransport; requests: OllamaChatRequest[] } {
  const requests: OllamaChatRequest[] = [];
  const transport: OllamaTransport = {
    async chatStream(req, onChunk) {
      requests.push(req);
      onChunk({
        message: { role: "assistant", content: typeof reply === "string" ? reply : JSON.stringify(reply) },
        done: true,
      });
    },
    async post() {
      throw new Error("unused");
    },
    async get() {
      throw new Error("unused");
    },
  };
  return { transport, requests };
}

describe("formatGroupTranscript", () => {
  it("labels user, speakers by id, and unknown speakers as Someone", () => {
    const msgs = [
      makeMessage({ role: "user", content: "Evening, all." }),
      makeMessage({ role: "assistant", content: "The lamp is lit.", speakerCharacterId: "char-elara" }),
      makeMessage({ role: "assistant", content: "Cold out there.", speakerCharacterId: "char-gone" }),
      makeMessage({ role: "system", content: "ignored" }),
    ];
    const out = formatGroupTranscript(msgs, SPEAKERS, "Tester");
    expect(out).toBe(
      "Tester: Evening, all.\nElara Vance: The lamp is lit.\nSomeone: Cold out there.",
    );
  });
});

describe("buildGroupRollupFormat", () => {
  it("embeds the participant-name enum in retainedBy", () => {
    const schema = buildGroupRollupFormat(["Elara Vance", "Jax Sterling"]);
    const retainedBy = (schema as any).properties.facts.items.properties.retainedBy;
    expect(retainedBy.items.enum).toEqual(["Elara Vance", "Jax Sterling"]);
    expect(retainedBy.minItems).toBe(1);
  });
});

describe("summarizeGroupRollup", () => {
  const msgs = [
    makeMessage({ role: "user", content: "My sister's wedding is in autumn." }),
    makeMessage({ role: "assistant", content: "How lovely.", speakerCharacterId: "char-elara" }),
  ];

  it("parses tagged facts and resolves names to ids (case-insensitive, first names)", async () => {
    const { transport, requests } = cannedTransport({
      summary: "They spoke of the wedding.",
      facts: [
        {
          content: "Tester's sister is getting married in autumn.",
          kind: "event",
          keys: ["wedding", "sister"],
          salience: 0.7,
          retainedBy: ["elara vance", "Jax"],
        },
      ],
    });
    const { summary, facts } = await summarizeGroupRollup(
      new OllamaClient(transport),
      "gemma4:26b",
      16384,
      msgs,
      SPEAKERS,
      "Tester",
    );
    expect(summary?.kind).toBe("summary");
    expect(summary?.content).toContain("wedding");
    expect(facts).toHaveLength(1);
    expect(facts[0]!.retainedByIds.sort()).toEqual(["char-elara", "char-jax"]);
    expect(facts[0]!.kind).toBe("event");

    // the request keeps the room's model + num_ctx (no runner reload) and
    // carries the schema-constrained format with thinking off
    const req = requests[0]!;
    expect(req.options?.num_ctx).toBe(16384);
    expect(req.think).toBe(false);
    expect((req.format as any)?.properties?.facts).toBeDefined();
  });

  it("drops facts whose retainers are unknown, and facts with no retainers", async () => {
    const { transport } = cannedTransport({
      summary: "",
      facts: [
        { content: "kept", kind: "fact", keys: [], salience: 0.5, retainedBy: ["Elara Vance"] },
        { content: "ghost", kind: "fact", keys: [], salience: 0.5, retainedBy: ["Nobody Real"] },
        { content: "orphan", kind: "fact", keys: [], salience: 0.5, retainedBy: [] },
      ],
    });
    const { summary, facts } = await summarizeGroupRollup(
      new OllamaClient(transport),
      "m",
      8192,
      msgs,
      SPEAKERS,
      "Tester",
    );
    expect(summary).toBeNull();
    expect(facts.map((f) => f.content)).toEqual(["kept"]);
  });

  it("keeps retainedBy pairing when an empty fact is skipped", async () => {
    const { transport } = cannedTransport({
      summary: "s",
      facts: [
        { content: "", kind: "fact", keys: [], salience: 0.5, retainedBy: ["Elara Vance"] },
        { content: "real", kind: "fact", keys: [], salience: 0.5, retainedBy: ["Jax Sterling"] },
      ],
    });
    const { facts } = await summarizeGroupRollup(
      new OllamaClient(transport),
      "m",
      8192,
      msgs,
      SPEAKERS,
      "Tester",
    );
    expect(facts).toHaveLength(1);
    expect(facts[0]!.retainedByIds).toEqual(["char-jax"]);
  });

  it("survives prose-wrapped JSON from older servers without format support", async () => {
    const { transport } = cannedTransport(
      'Sure! ```json\n{"summary":"a night by the fire","facts":[{"content":"Tester fears storms.","kind":"fact","keys":["storm"],"salience":0.6,"retainedBy":["Elara Vance"]}]}\n```',
    );
    const { summary, facts } = await summarizeGroupRollup(
      new OllamaClient(transport),
      "m",
      8192,
      msgs,
      SPEAKERS,
      "Tester",
    );
    expect(summary?.content).toBe("a night by the fire");
    expect(facts[0]!.retainedByIds).toEqual(["char-elara"]);
  });
});
