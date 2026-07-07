import { describe, it, expect } from "vitest";
import { assembleContext, describeTimeGap, resolveModel, type AssembleInput } from "../context";
import { makeSoul } from "./fixtures";
import {
  makeCharacter,
  makePersona,
  makeRelationship,
  makeConversation,
  makeMessage,
  makeMemory,
  makeLore,
} from "./fixtures";

function baseInput(over: Partial<AssembleInput> = {}): AssembleInput {
  return {
    numCtx: 16384,
    temperature: 0.85,
    model: "gemma4:26b",
    character: makeCharacter(),
    persona: makePersona(),
    userName: "traveller",
    relationship: makeRelationship(),
    conversation: makeConversation(),
    verbatim: [],
    newUser: { content: "I came back." },
    triggeredLore: [],
    recalledMemories: [],
    ...over,
  };
}

describe("assembleContext", () => {
  it("composes all layers into the system prompt", () => {
    const ctx = assembleContext(
      baseInput({
        conversation: makeConversation({ sceneState: "by the lighthouse" }),
        triggeredLore: [makeLore({ content: "The lamp never goes out." })],
        recalledMemories: [makeMemory({ content: "User takes their tea black." })],
      }),
    );
    const sys = ctx.request.messages[0]!;
    expect(sys.role).toBe("system");
    expect(sys.content).toContain("<soul>");
    expect(sys.content).toContain("Sera Vane");
    expect(sys.content).toContain("<about_user>");
    expect(sys.content).toContain("traveller");
    expect(sys.content).toContain("I take my tea black"); // persona profile
    expect(sys.content).toContain("<relationship>");
    expect(sys.content).toContain("met by the lighthouse");
    expect(sys.content).toContain("User takes their tea black."); // recalled memory
    expect(sys.content).toContain("The lamp never goes out."); // lore
    expect(sys.content).toContain("<scene>");
    expect(sys.content).toContain("by the lighthouse");
  });

  it("appends the new user message last", () => {
    const ctx = assembleContext(
      baseInput({
        verbatim: [makeMessage({ role: "assistant", content: "Welcome." })],
      }),
    );
    const msgs = ctx.request.messages;
    const last = msgs[msgs.length - 1]!;
    expect(last.role).toBe("user");
    expect(last.content).toBe("I came back.");
  });

  it("prepends the think token only when thinking is on", () => {
    const off = assembleContext(baseInput());
    expect(off.request.messages[0]!.content.startsWith("<|think|>")).toBe(false);
    const on = assembleContext(baseInput({ character: makeCharacter({ thinking: true }) }));
    expect(on.request.messages[0]!.content.startsWith("<|think|>")).toBe(true);
    expect(on.request.think).toBe(true);
  });

  it("sets the managed context window and never the silent 4K default", () => {
    const ctx = assembleContext(baseInput({ numCtx: 32768 }));
    expect(ctx.request.options?.num_ctx).toBe(32768);
  });

  it("drops oldest verbatim turns to fit a tiny budget but keeps the new message", () => {
    const verbatim = Array.from({ length: 20 }, (_, i) =>
      makeMessage({ role: i % 2 ? "assistant" : "user", content: "x".repeat(400) }),
    );
    const ctx = assembleContext(baseInput({ numCtx: 400, verbatim }));
    expect(ctx.budget.droppedTurns).toBeGreaterThan(0);
    const last = ctx.request.messages[ctx.request.messages.length - 1]!;
    expect(last.content).toBe("I came back.");
  });

  it("renders example dialogue as a voice_examples layer", () => {
    const soul = makeSoul({
      exampleDialogue: [{ user: "How was your day?", character: "Quiet. Good-quiet." }],
    });
    const ctx = assembleContext(baseInput({ character: makeCharacter({ soul }) }));
    const sys = ctx.request.messages[0]!.content;
    expect(sys).toContain("<voice_examples>");
    expect(sys).toContain("Them: How was your day?");
    expect(sys).toContain("You: Quiet. Good-quiet.");
    // absent when none authored
    const bare = assembleContext(baseInput());
    expect(bare.request.messages[0]!.content).not.toContain("<voice_examples>");
  });

  it("renders speech registers inside the soul", () => {
    const soul = makeSoul({
      registers: [{ when: "her passion ignites", how: "faster, longer, vivid sentences" }],
    });
    const ctx = assembleContext(baseInput({ character: makeCharacter({ soul }) }));
    const sys = ctx.request.messages[0]!.content;
    expect(sys).toContain("How your voice shifts with the moment");
    expect(sys).toContain("When her passion ignites: faster, longer, vivid sentences");
  });

  it("notes the time since they last spoke, but only for real gaps", () => {
    const DAY = 86_400_000;
    const withGap = assembleContext(baseInput({ now: 4 * DAY, lastInteractionAt: 1 * DAY }));
    expect(withGap.request.messages[0]!.content).toContain("It's been about 3 days");
    const smallGap = assembleContext(baseInput({ now: 3_600_000, lastInteractionAt: 0 }));
    expect(smallGap.request.messages[0]!.content).not.toContain("It's been");
    const noInfo = assembleContext(baseInput());
    expect(noInfo.request.messages[0]!.content).not.toContain("It's been");
  });

  it("carries the relationship's affect into the relationship layer", () => {
    const ctx = assembleContext(
      baseInput({
        relationship: makeRelationship({ affect: "Still glowing that they asked about my armor." }),
      }),
    );
    const sys = ctx.request.messages[0]!.content;
    expect(sys).toContain("How the last conversation left you feeling");
    expect(sys).toContain("Still glowing that they asked about my armor.");
    const bare = assembleContext(baseInput());
    expect(bare.request.messages[0]!.content).not.toContain("How the last conversation left you feeling");
  });

  it("emphasizes tells when a tender memory is recalled", () => {
    const tender = makeMemory({ kind: "tender", content: "They admitted they're scared of losing wonder." });
    const ctx = assembleContext(baseInput({ recalledMemories: [tender] }));
    const sys = ctx.request.messages[0]!.content;
    expect(sys).toContain("Something tender is close to the surface");
    expect(sys).toContain("Goes very still when she means something."); // the character's tells
    const ordinary = assembleContext(baseInput({ recalledMemories: [makeMemory()] }));
    expect(ordinary.request.messages[0]!.content).not.toContain("Something tender is close to the surface");
  });

  it("passes images through on the new user message", () => {
    const ctx = assembleContext(
      baseInput({
        newUser: { content: "look", attachments: [{ kind: "image", data: "AAAA", mime: "image/png" }] },
      }),
    );
    const last = ctx.request.messages[ctx.request.messages.length - 1]!;
    expect(last.images).toEqual(["AAAA"]);
  });
});

describe("describeTimeGap", () => {
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  it("is silent under four hours", () => {
    expect(describeTimeGap(3 * HOUR, 0)).toBeNull();
  });
  it("scales through hours, days, weeks, months", () => {
    expect(describeTimeGap(10 * HOUR, 0)).toBe("about 10 hours");
    expect(describeTimeGap(5 * DAY, 0)).toBe("about 5 days");
    expect(describeTimeGap(21 * DAY, 0)).toBe("about 3 weeks");
    expect(describeTimeGap(95 * DAY, 0)).toBe("about 3 months");
  });
});

describe("resolveModel", () => {
  it("prefers the relationship override, then the character, then the fallback", () => {
    expect(resolveModel(makeRelationship({ modelOverride: "x" }), makeCharacter(), "fb")).toBe("x");
    expect(resolveModel(makeRelationship(), makeCharacter({ defaultModel: "y" }), "fb")).toBe("y");
    expect(
      resolveModel(makeRelationship(), makeCharacter({ defaultModel: "" }), "fb"),
    ).toBe("fb");
  });
});
