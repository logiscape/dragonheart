import { describe, it, expect } from "vitest";
import { assembleContext, resolveModel, type AssembleInput } from "../context";
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

describe("resolveModel", () => {
  it("prefers the relationship override, then the character, then the fallback", () => {
    expect(resolveModel(makeRelationship({ modelOverride: "x" }), makeCharacter(), "fb")).toBe("x");
    expect(resolveModel(makeRelationship(), makeCharacter({ defaultModel: "y" }), "fb")).toBe("y");
    expect(
      resolveModel(makeRelationship(), makeCharacter({ defaultModel: "" }), "fb"),
    ).toBe("fb");
  });
});
