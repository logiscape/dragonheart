import { describe, it, expect } from "vitest";
import { rankMemoriesForRecall, shouldRollup } from "../memory";
import { makeMemory } from "./fixtures";

describe("rankMemoriesForRecall", () => {
  it("ranks by semantic relevance when embeddings exist", () => {
    const near = makeMemory({ id: "near", embedding: [1, 0], salience: 0.4 });
    const far = makeMemory({ id: "far", embedding: [0, 1], salience: 0.4 });
    const out = rankMemoriesForRecall([far, near], {
      queryEmbedding: [1, 0],
      recentText: "",
      now: 2000,
      k: 2,
    });
    expect(out[0]!.id).toBe("near");
  });

  it("falls back to keyword overlap without embeddings", () => {
    const hit = makeMemory({ id: "hit", keys: ["wedding"], embedding: null, salience: 0.3 });
    const miss = makeMemory({ id: "miss", keys: ["weather"], embedding: null, salience: 0.3 });
    const out = rankMemoriesForRecall([miss, hit], {
      queryEmbedding: null,
      recentText: "her sister's wedding is in autumn",
      now: 2000,
      k: 1,
    });
    expect(out[0]!.id).toBe("hit");
  });

  it("excludes disabled memories", () => {
    const off = makeMemory({ id: "off", enabled: false, keys: ["tea"], salience: 0.9 });
    const out = rankMemoriesForRecall([off], {
      queryEmbedding: null,
      recentText: "tea",
      now: 2000,
      k: 5,
    });
    expect(out).toHaveLength(0);
  });

  it("always surfaces pinned memories even with no relevance", () => {
    const pinned = makeMemory({ id: "pin", pinned: true, keys: [], embedding: null, salience: 0.1 });
    const out = rankMemoriesForRecall([pinned], {
      queryEmbedding: null,
      recentText: "completely unrelated",
      now: 2000,
      k: 5,
    });
    expect(out.map((m) => m.id)).toContain("pin");
  });
});

describe("shouldRollup", () => {
  it("triggers past the token threshold", () => {
    expect(shouldRollup(7000, 6000)).toBe(true);
    expect(shouldRollup(5000, 6000)).toBe(false);
  });
});
