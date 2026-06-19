import { describe, it, expect } from "vitest";
import {
  parseCardText,
  parseCardBytes,
  cardToDraft,
  characterToCard,
  cardToJsonBytes,
  embedCardInPng,
  extractPngCardText,
  type CardV2,
} from "../characterCard";

const V2: CardV2 = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "Sera Vane",
    description: "A lighthouse keeper who remembers everyone.",
    personality: "Warm, unhurried, wistful.",
    scenario: "By the lighthouse at dusk.",
    first_mes: "You came back.",
    tags: ["melancholic", "loyal"],
    character_book: {
      entries: [
        { keys: ["lighthouse"], content: "It has stood 200 years.", enabled: true },
        { keys: [], content: "", enabled: true }, // empty → dropped
      ],
    },
  },
};

describe("card parsing & mapping", () => {
  it("parses a V2 JSON card and maps it to a draft", () => {
    const card = parseCardText(JSON.stringify(V2))!;
    expect(card.data.name).toBe("Sera Vane");
    const draft = cardToDraft(card);
    expect(draft.name).toBe("Sera Vane");
    expect(draft.firstMessage).toBe("You came back.");
    expect(draft.traits).toEqual(["melancholic", "loyal"]);
    expect(draft.soul.freeform).toContain("A lighthouse keeper");
    expect(draft.soul.freeform).toContain("Personality:");
    expect(draft.soul.voice).toBe("Warm, unhurried, wistful.");
    expect(draft.loreDrafts).toHaveLength(1); // empty entry filtered out
    expect(draft.loreDrafts[0]!.keys).toEqual(["lighthouse"]);
    expect(draft.scenario).toBe("By the lighthouse at dusk.");
  });

  it("normalizes a flat V1-style card (no data wrapper)", () => {
    const flat = JSON.stringify({ name: "Bram", first_mes: "Sit." });
    const card = parseCardText(flat)!;
    expect(card.data.name).toBe("Bram");
    expect(cardToDraft(card).firstMessage).toBe("Sit.");
  });

  it("builds a card from an export source", () => {
    const card = characterToCard({
      name: "Sera Vane",
      epithet: "Keeper of the lighthouse",
      blurb: "She waits.",
      soulText: "Who she is.",
      voice: "Warm.",
      firstMessage: "You came back.",
      scenario: "",
      traits: ["loyal"],
      lore: [{ keys: ["lamp"], content: "Always lit.", enabled: true, caseSensitive: false }],
    });
    expect(card.spec).toBe("chara_card_v2");
    expect(card.data.name).toBe("Sera Vane");
    expect(card.data.first_mes).toBe("You came back.");
    expect(card.data.character_book?.entries?.[0]?.keys).toEqual(["lamp"]);
    expect(cardToJsonBytes(card).length).toBeGreaterThan(0);
  });
});

// minimal structurally-valid PNG (chunks parsed by length; CRC not verified)
function fakePng(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  function chunk(type: string, dataLen: number): number[] {
    const len = [(dataLen >>> 24) & 255, (dataLen >>> 16) & 255, (dataLen >>> 8) & 255, dataLen & 255];
    const t = [...type].map((c) => c.charCodeAt(0));
    const data = new Array(dataLen).fill(0);
    const crc = [0, 0, 0, 0];
    return [...len, ...t, ...data, ...crc];
  }
  return new Uint8Array([...sig, ...chunk("IHDR", 13), ...chunk("IEND", 0)]);
}

describe("PNG card embedding roundtrip", () => {
  it("embeds a card into a PNG and reads it back", () => {
    const card = parseCardText(JSON.stringify(V2))!;
    const png = embedCardInPng(card, fakePng());
    const text = extractPngCardText(png);
    expect(text).not.toBeNull();
    const back = parseCardBytes(png)!;
    expect(back.data.name).toBe("Sera Vane");
    expect(back.data.first_mes).toBe("You came back.");
  });

  it("rejects a non-PNG base image", () => {
    const card = parseCardText(JSON.stringify(V2))!;
    expect(() => embedCardInPng(card, new Uint8Array([1, 2, 3]))).toThrow();
  });
});
