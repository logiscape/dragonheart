import { describe, it, expect } from "vitest";
import { estimateTokens, estimateMessageTokens } from "../tokens";
import { cosineSim, topKBySimilarity } from "../vector";
import { parseJsonLoose, uniqueStrings, clamp } from "../util";
import { soulToPrompt, soulIsAuthored, blankSoul } from "../soul";
import { makeCharacter, makeSoul } from "./fixtures";

describe("tokens", () => {
  it("estimates ~4 chars/token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
  it("adds per-message overhead", () => {
    expect(estimateMessageTokens({ content: "abcd" })).toBe(1 + 4);
  });
});

describe("vector", () => {
  it("cosine of identical vectors is 1, orthogonal is 0", () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("handles zero vectors safely", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
  it("topK ranks by similarity and skips missing embeddings", () => {
    const items = [
      { id: "a", e: [1, 0] },
      { id: "b", e: [0.9, 0.1] },
      { id: "c", e: null as number[] | null },
      { id: "d", e: [0, 1] },
    ];
    const ranked = topKBySimilarity(items, [1, 0], (i) => i.e, 2);
    expect(ranked.map((r) => r.item.id)).toEqual(["a", "b"]);
  });
});

describe("util.parseJsonLoose", () => {
  it("parses clean JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses JSON wrapped in prose and code fences", () => {
    expect(parseJsonLoose('Sure!\n```json\n{"a":2}\n```\nDone')).toEqual({ a: 2 });
  });
  it("extracts the first balanced object from noisy text", () => {
    expect(parseJsonLoose('garbage {"memories":[{"content":"x"}]} trailing')).toEqual({
      memories: [{ content: "x" }],
    });
  });
  it("returns null when there is no JSON", () => {
    expect(parseJsonLoose("no json here")).toBeNull();
  });
});

describe("util helpers", () => {
  it("uniqueStrings dedupes case-insensitively and trims", () => {
    expect(uniqueStrings(["Tea", " tea ", "", null, "Sea"])).toEqual(["Tea", "Sea"]);
  });
  it("clamp bounds values", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe("soul", () => {
  it("renders structured fields with the name and identity footer", () => {
    const c = makeCharacter();
    const out = soulToPrompt(c);
    expect(out).toContain("Sera Vane");
    expect(out).toContain("Keeper of the lighthouse");
    expect(out).toContain("To be needed without being consumed");
    expect(out).toContain("constancy; small rituals");
    expect(out).toContain("never mention being an AI");
  });
  it("uses freeform verbatim when present", () => {
    const c = makeCharacter({ soul: makeSoul({ freeform: "JUST THIS." }) });
    expect(soulToPrompt(c)).toBe("JUST THIS.");
  });
  it("detects authored vs blank souls", () => {
    expect(soulIsAuthored(blankSoul())).toBe(false);
    expect(soulIsAuthored(makeSoul())).toBe(true);
  });
});
