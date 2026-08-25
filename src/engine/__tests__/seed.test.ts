import { describe, it, expect } from "vitest";
import { starterCharacters, starterLore } from "../seed";
import { triggerByKeyword } from "../lorebook";
import { soulToPrompt, voiceExamplesToPrompt } from "../soul";
import { makeCharacter } from "./fixtures";
import type { LoreEntry } from "../types";

/** The five who share the Graywatch universe; Spark stands outside it. */
const GRAYWATCH_CIRCLE = ["Sera Vane", "Bram Holt", "Odelle", "Wren", "Zynthesis"];

describe("starterCharacters", () => {
  it("ships the Graywatch circle and Spark", () => {
    const chars = starterCharacters();
    expect(chars.map((c) => c.name)).toEqual([...GRAYWATCH_CIRCLE, "Spark"]);
    const sera = chars[0]!;
    expect(sera.soul.voice).toContain("The sea isn't going anywhere");
  });

  it("bakes in no models, so starters always follow the hearth settings", () => {
    for (const c of starterCharacters()) {
      expect(c.defaultModel, c.name).toBeNull();
      expect(c.fastModel, c.name).toBeNull();
    }
  });

  it("gives every starter a full soul: registers, examples, and lore", () => {
    for (const c of starterCharacters()) {
      expect(c.soul.coreIdentity.length, c.name).toBeGreaterThan(0);
      expect(c.soul.wounds.length, c.name).toBeGreaterThan(0);
      expect(c.soul.contradiction.length, c.name).toBeGreaterThan(0);
      expect(c.soul.registers!.length, c.name).toBeGreaterThanOrEqual(2);
      expect(c.soul.exampleDialogue!.length, c.name).toBeGreaterThanOrEqual(2);
      expect(c.firstMessage.length, c.name).toBeGreaterThan(0);
      expect(starterLore(c.name, "x").length, c.name).toBeGreaterThan(0);
    }
  });

  it("gives every Graywatch character circle lore naming the other four", () => {
    for (const name of GRAYWATCH_CIRCLE) {
      const lore = starterLore(name, "x");
      const circle = lore.find((l) => l.keys.includes("graywatch"));
      expect(circle, name).toBeDefined();
      const others = ["Sera", "Bram", "Odelle", "Wren", "Zynthesis"].filter(
        (n) => !name.includes(n),
      );
      for (const other of others) {
        expect(circle!.content, `${name} should know ${other}`).toContain(other);
      }
    }
  });

  it("gives Spark a one-way hook: anomalous records of Graywatch, unknown to the circle", () => {
    const anomaly = starterLore("Spark", "x").find((l) => l.keys.includes("graywatch"));
    expect(anomaly).toBeDefined();
    expect(anomaly!.content).toContain("SHOULD NOT EXIST");
    // the fantasy five have never heard of Spark
    for (const name of GRAYWATCH_CIRCLE) {
      for (const l of starterLore(name, "x")) {
        expect(l.content, `${name} should not know Spark`).not.toContain("Spark");
      }
    }
  });

  it("wires avatars by name and defaults to null", () => {
    const withAvatar = starterCharacters({ "Sera Vane": "data:image/jpeg;base64,x" });
    expect(withAvatar[0]!.avatarPath).toBe("data:image/jpeg;base64,x");
    expect(withAvatar[1]!.avatarPath).toBeNull();
    const without = starterCharacters();
    expect(without[0]!.avatarPath).toBeNull();
  });

  it("renders Sera's soul with shifting registers, not one constant wistful note", () => {
    const sera = starterCharacters()[0]!;
    const char = makeCharacter({ name: sera.name, epithet: sera.epithet, soul: sera.soul });
    const prompt = soulToPrompt(char);
    expect(prompt).toContain("Sera Vane");
    expect(prompt).toContain("the keeper's voice");
    expect(prompt).toContain("How your voice shifts with the moment");
    // examples render separately as few-shots, not inside the soul
    expect(prompt).not.toContain("Them:");
    const examples = voiceExamplesToPrompt(char);
    expect(examples).toContain("Them: How was your day?");
    expect(examples).toContain("never lines to repeat");
  });
});

describe("starterLore", () => {
  it("binds Sera's lore entries to the created character id", () => {
    const lore = starterLore("Sera Vane", "char-42");
    expect(lore.length).toBeGreaterThan(0);
    for (const l of lore) {
      expect(l.scope).toBe("character");
      expect(l.ownerId).toBe("char-42");
      expect(l.enabled).toBe(true);
    }
  });

  it("returns nothing for unknown characters", () => {
    expect(starterLore("Unknown", "char-1")).toEqual([]);
  });

  it("fires her lighthouse lore on-topic and stays silent off-topic", () => {
    const now = 1000;
    const entries: LoreEntry[] = starterLore("Sera Vane", "char-42").map((l, i) => ({
      ...l,
      id: `lore-${i}`,
      createdAt: now,
      updatedAt: now,
    }));
    const onTopic = triggerByKeyword(
      entries,
      "The storm is rising — do you think the lamp will hold until morning?",
    );
    expect(onTopic.some((e) => e.content.includes("ninety-two steps"))).toBe(true);
    const offTopic = triggerByKeyword(entries, "How was your day at the coffee shop?");
    expect(offTopic).toEqual([]);
  });
});
