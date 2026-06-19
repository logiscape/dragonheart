import { describe, it, expect } from "vitest";
import { triggerByKeyword, triggerLore } from "../lorebook";
import { makeLore } from "./fixtures";

describe("triggerByKeyword", () => {
  it("fires only when a key appears, respecting enabled", () => {
    const a = makeLore({ id: "a", keys: ["lighthouse"] });
    const b = makeLore({ id: "b", keys: ["bees"] });
    const off = makeLore({ id: "c", keys: ["lighthouse"], enabled: false });
    const hits = triggerByKeyword([a, b, off], "tell me about the lighthouse");
    expect(hits.map((h) => h.id)).toEqual(["a"]);
  });

  it("respects case sensitivity", () => {
    const cs = makeLore({ id: "cs", keys: ["Lamp"], caseSensitive: true });
    expect(triggerByKeyword([cs], "the lamp is lit")).toHaveLength(0);
    expect(triggerByKeyword([cs], "the Lamp is lit")).toHaveLength(1);
  });
});

describe("triggerLore", () => {
  it("keyword hits take precedence and rank above semantic", () => {
    const kw = makeLore({ id: "kw", keys: ["lighthouse"] });
    const sem = makeLore({ id: "sem", keys: ["nope"], embedding: [1, 0] });
    const hits = triggerLore([kw, sem], "the lighthouse glows", {
      queryEmbedding: [1, 0],
      semanticThreshold: 0.5,
    });
    expect(hits[0]!.entry.id).toBe("kw");
    expect(hits[0]!.reason).toBe("keyword");
    expect(hits.some((h) => h.entry.id === "sem" && h.reason === "semantic")).toBe(true);
  });

  it("semantic entries below threshold do not fire", () => {
    const sem = makeLore({ id: "sem", keys: ["nope"], embedding: [0, 1] });
    const hits = triggerLore([sem], "unrelated text", {
      queryEmbedding: [1, 0],
      semanticThreshold: 0.5,
    });
    expect(hits).toHaveLength(0);
  });

  it("caps the number of entries", () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      makeLore({ id: `e${i}`, keys: ["lighthouse"] }),
    );
    const hits = triggerLore(entries, "lighthouse", { maxEntries: 5 });
    expect(hits).toHaveLength(5);
  });
});
