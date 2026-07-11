import { describe, it, expect } from "vitest";
import { assembleContext, resolveRoomModel, sanitizeGroupReply, type AssembleInput } from "../context";
import { DEFAULT_SETTINGS } from "../types";
import {
  makeCharacter,
  makeMessage,
  makePersona,
  makeRelationship,
  makeRoomConversation,
} from "./fixtures";

const ELARA = makeCharacter({ id: "char-elara", name: "Elara Vance", epithet: "Keeper of the lighthouse" });
const JAX = makeCharacter({ id: "char-jax", name: "Jax Sterling", epithet: "Wandering tinker" });

function groupInput(over: Partial<AssembleInput> = {}): AssembleInput {
  return {
    numCtx: 8192,
    temperature: 0.8,
    model: "gemma4:26b",
    character: ELARA,
    persona: makePersona(),
    userName: "Robin",
    relationship: makeRelationship({ characterId: ELARA.id }),
    conversation: makeRoomConversation(),
    verbatim: [],
    newUser: null,
    triggeredLore: [],
    recalledMemories: [],
    group: {
      roomName: "The Hearth",
      selfCharacterId: ELARA.id,
      participants: [
        { id: ELARA.id, name: ELARA.name, epithet: ELARA.epithet },
        { id: JAX.id, name: JAX.name, epithet: JAX.epithet },
      ],
    },
    ...over,
  };
}

describe("group context assembly", () => {
  it("adds a <room> block naming the others and the self-only instruction", () => {
    const { request } = assembleContext(groupInput());
    const system = request.messages[0]!.content;
    expect(system).toContain("<room>");
    expect(system).toContain('"The Hearth"');
    expect(system).toContain("Robin — the human");
    expect(system).toContain("Jax Sterling — Wandering tinker");
    // the speaker themself is not listed among "present with you"
    expect(system).not.toContain("- Elara Vance");
    expect(system).toContain("You are Elara Vance and only Elara Vance.");
    // per-character layers are still there
    expect(system).toContain("<soul>");
    expect(system).toContain("<relationship>");
  });

  it("keeps own turns as unlabeled assistant turns and labels everyone else", () => {
    const verbatim = [
      makeMessage({ role: "user", content: "Evening, you two." }),
      makeMessage({ role: "assistant", content: "The lamp is lit.", speakerCharacterId: ELARA.id }),
      makeMessage({ role: "assistant", content: "Cold night for it.", speakerCharacterId: JAX.id }),
      makeMessage({ role: "user", content: "Come in by the fire." }),
    ];
    const { request } = assembleContext(groupInput({ verbatim }));
    const msgs = request.messages.slice(1);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[0]!.content).toBe("Robin: Evening, you two.");
    expect(msgs[1]!.content).toBe("The lamp is lit.");
    // Jax's line and Robin's follow-up merge into one alternation-preserving user turn
    expect(msgs[2]!.content).toBe("Jax Sterling: Cold night for it.\n\nRobin: Come in by the fire.");
  });

  it("labels an unknown (departed) speaker as Someone", () => {
    const verbatim = [
      makeMessage({ role: "assistant", content: "Old words.", speakerCharacterId: "char-gone" }),
    ];
    const { request } = assembleContext(groupInput({ verbatim }));
    expect(request.messages[1]!.content).toBe("Someone: Old words.");
  });

  it("labels a new user message and merges it into a trailing foreign run", () => {
    const verbatim = [
      makeMessage({ role: "assistant", content: "Anyone there?", speakerCharacterId: JAX.id }),
    ];
    const { request } = assembleContext(
      groupInput({ verbatim, newUser: { content: "Just me." } }),
    );
    const last = request.messages[request.messages.length - 1]!;
    expect(last.role).toBe("user");
    expect(last.content).toBe("Jax Sterling: Anyone there?\n\nRobin: Just me.");
  });

  it("carries images through the merge", () => {
    const verbatim = [
      makeMessage({
        role: "user",
        content: "Look at this.",
        attachments: [{ kind: "image", data: "abc123", mime: "image/png" }],
      }),
      makeMessage({ role: "assistant", content: "Oh?", speakerCharacterId: JAX.id }),
    ];
    const { request } = assembleContext(groupInput({ verbatim }));
    const merged = request.messages[1]!;
    expect(merged.role).toBe("user");
    expect(merged.images).toEqual(["abc123"]);
  });

  it("drops the oldest rendered lines first under budget pressure", () => {
    const verbatim = Array.from({ length: 40 }, (_, i) =>
      makeMessage({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `line ${i} ` + "x".repeat(400),
        speakerCharacterId: i % 2 === 0 ? null : JAX.id,
      }),
    );
    const { request, budget } = assembleContext(groupInput({ numCtx: 2048, verbatim }));
    expect(budget.droppedTurns).toBeGreaterThan(0);
    const text = request.messages.slice(1).map((m) => m.content).join("\n");
    expect(text).toContain("line 39");
    expect(text).not.toContain("line 0 ");
  });
});

describe("sanitizeGroupReply", () => {
  const others = ["Jax Sterling", "Robin"];

  it("strips a leading self-label", () => {
    expect(sanitizeGroupReply("Elara Vance: The lamp is lit.", "Elara Vance", others)).toBe(
      "The lamp is lit.",
    );
    expect(sanitizeGroupReply("**Elara Vance**: Hello.", "Elara Vance", others)).toBe("Hello.");
  });

  it("truncates where the reply starts speaking for someone else", () => {
    const raw = "The lamp is lit.\nJax Sterling: And I fixed the door.\nElara Vance: Good.";
    expect(sanitizeGroupReply(raw, "Elara Vance", others)).toBe("The lamp is lit.");
  });

  it("truncates at the earliest foreign label regardless of order given", () => {
    const raw = "Fine.\nRobin: am I next?\nJax Sterling: or me?";
    expect(sanitizeGroupReply(raw, "Elara Vance", ["Jax Sterling", "Robin"])).toBe("Fine.");
  });

  it("leaves plain replies untouched and never cuts mid-line mentions", () => {
    const raw = "I told Jax Sterling: he should rest. He laughed.";
    expect(sanitizeGroupReply(raw, "Elara Vance", others)).toBe(raw);
  });
});

describe("resolveRoomModel", () => {
  it("always uses the app default model", () => {
    expect(resolveRoomModel({ ...DEFAULT_SETTINGS, defaultModel: "gemma4:26b" })).toBe("gemma4:26b");
  });
});
