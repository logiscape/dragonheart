import { describe, it, expect } from "vitest";
import { starterCharacters, starterLore } from "../seed";
import { triggerByKeyword } from "../lorebook";
import { soulToPrompt, voiceExamplesToPrompt } from "../soul";
import { makeCharacter } from "./fixtures";
import type { LoreEntry } from "../types";

describe("starterCharacters", () => {
  it("ships Elara and the Fellowship of the Hearth", () => {
    const chars = starterCharacters("gemma4:26b", "gemma4:e4b");
    expect(chars.map((c) => c.name)).toEqual([
      "Elara Vance",
      "Jax Sterling",
      "Silas Thorne",
      "Mira Chen",
      "Leo Aris",
    ]);
    const elara = chars[0]!;
    expect(elara.soul.voice).toContain("prepare the vessel");
  });

  it("gives every starter a full soul: registers, examples, and lore", () => {
    for (const c of starterCharacters("m", null)) {
      expect(c.soul.coreIdentity.length, c.name).toBeGreaterThan(0);
      expect(c.soul.wounds.length, c.name).toBeGreaterThan(0);
      expect(c.soul.contradiction.length, c.name).toBeGreaterThan(0);
      expect(c.soul.registers!.length, c.name).toBeGreaterThanOrEqual(2);
      expect(c.soul.exampleDialogue!.length, c.name).toBeGreaterThanOrEqual(2);
      expect(c.firstMessage.length, c.name).toBeGreaterThan(0);
      expect(starterLore(c.name, "x").length, c.name).toBeGreaterThan(0);
    }
  });

  it("gives every friend lore about the rest of the Fellowship", () => {
    for (const c of starterCharacters("m", null)) {
      const lore = starterLore(c.name, "x");
      const fellowship = lore.find((l) => l.keys.includes("fellowship"));
      expect(fellowship, c.name).toBeDefined();
      // each character's fellowship entry names the other four
      const others = ["Elara", "Jax", "Silas", "Mira", "Leo"].filter(
        (n) => !c.name.includes(n),
      );
      for (const other of others) {
        expect(fellowship!.content, `${c.name} should know ${other}`).toContain(other);
      }
    }
  });

  it("wires avatars by name and defaults to null", () => {
    const withAvatar = starterCharacters("m", null, { "Elara Vance": "data:image/jpeg;base64,x" });
    expect(withAvatar[0]!.avatarPath).toBe("data:image/jpeg;base64,x");
    expect(withAvatar[1]!.avatarPath).toBeNull();
    const without = starterCharacters("m", null);
    expect(without[0]!.avatarPath).toBeNull();
  });

  it("renders Elara's soul with shifting registers, not a constant epic voice", () => {
    const elara = starterCharacters("m", null)[0]!;
    const char = makeCharacter({ name: elara.name, epithet: elara.epithet, soul: elara.soul });
    const prompt = soulToPrompt(char);
    expect(prompt).toContain("Elara Vance");
    expect(prompt).toContain("not how she always talks");
    expect(prompt).toContain("How your voice shifts with the moment");
    // examples render separately as few-shots, not inside the soul
    expect(prompt).not.toContain("Them:");
    const examples = voiceExamplesToPrompt(char);
    expect(examples).toContain("Them: How was your day?");
    expect(examples).toContain("never lines to repeat");
  });
});

describe("starterLore", () => {
  it("binds Elara's lore entries to the created character id", () => {
    const lore = starterLore("Elara Vance", "char-42");
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

  it("fires her dragon lore on-topic and stays silent off-topic", () => {
    const now = 1000;
    const entries: LoreEntry[] = starterLore("Elara Vance", "char-42").map((l, i) => ({
      ...l,
      id: `lore-${i}`,
      createdAt: now,
      updatedAt: now,
    }));
    const onTopic = triggerByKeyword(entries, "Tell me about dragon myths from Wales");
    expect(onTopic.some((e) => e.content.includes("Y Ddraig Goch"))).toBe(true);
    const offTopic = triggerByKeyword(entries, "How was your day at the coffee shop?");
    expect(offTopic).toEqual([]);
  });
});
