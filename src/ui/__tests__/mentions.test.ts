import { describe, it, expect } from "vitest";
import { findMentionToken, mentionMatches, applyMention } from "../mentions";

describe("findMentionToken", () => {
  it("opens a token at a bare @ and tracks the query to the caret", () => {
    expect(findMentionToken("@", 1)).toEqual({ start: 0, query: "" });
    expect(findMentionToken("hey @Ela", 8)).toEqual({ start: 4, query: "Ela" });
    expect(findMentionToken("hey @Elara V", 12)).toEqual({ start: 4, query: "Elara V" });
  });

  it("only text before the caret counts", () => {
    expect(findMentionToken("@Elara hello", 3)).toEqual({ start: 0, query: "El" });
    expect(findMentionToken("hello @Elara", 5)).toBeNull();
  });

  it("an @ inside a word is not a mention", () => {
    expect(findMentionToken("mail me at jax@sterling.dev", 27)).toBeNull();
  });

  it("dies at a newline, another @, or a leading space", () => {
    expect(findMentionToken("@Ela\nra", 7)).toBeNull();
    expect(findMentionToken("@ Elara", 7)).toBeNull();
    // a second @ simply starts a new token
    expect(findMentionToken("@Elara @J", 9)).toEqual({ start: 7, query: "J" });
  });
});

describe("mentionMatches", () => {
  it("matches the empty query, full-name prefixes, and any-word prefixes", () => {
    expect(mentionMatches("", "Elara Vance")).toBe(true);
    expect(mentionMatches("ela", "Elara Vance")).toBe(true);
    expect(mentionMatches("elara v", "Elara Vance")).toBe(true);
    expect(mentionMatches("van", "Elara Vance")).toBe(true);
  });

  it("rejects non-prefix and overshot queries", () => {
    expect(mentionMatches("lara", "Elara Vance")).toBe(false);
    expect(mentionMatches("elara vance x", "Elara Vance")).toBe(false);
    // "Jax" does not swallow "Jaxon" the other way: prefix still matches
    expect(mentionMatches("jax", "Jaxon Reed")).toBe(true);
    expect(mentionMatches("jaxon", "Jax Sterling")).toBe(false);
  });
});

describe("applyMention", () => {
  it("replaces the token with @Full Name and lands the caret after it", () => {
    const out = applyMention("hey @Ela", 8, { start: 4, query: "Ela" }, "Elara Vance");
    expect(out.text).toBe("hey @Elara Vance ");
    expect(out.caret).toBe(17);
  });

  it("preserves text after the caret without doubling the space", () => {
    const out = applyMention("@Ja what do you think?", 3, { start: 0, query: "Ja" }, "Jax Sterling");
    expect(out.text).toBe("@Jax Sterling what do you think?");
    expect(out.caret).toBe("@Jax Sterling".length);
  });

  it("replaces the whole mention when the caret sits inside an existing one", () => {
    // caret after "@Ela" inside "@Elara Vance" must not duplicate "ra Vance"
    const out = applyMention("@Elara Vance hi", 4, { start: 0, query: "Ela" }, "Elara Vance");
    expect(out.text).toBe("@Elara Vance hi");
    expect(out.caret).toBe("@Elara Vance".length);

    const end = applyMention("@Elara Vance", 4, { start: 0, query: "Ela" }, "Elara Vance");
    expect(end.text).toBe("@Elara Vance ");
    expect(end.caret).toBe("@Elara Vance ".length);
  });

  it("absorbs only the tail that actually matches the chosen name", () => {
    // "r" continues "Elara"; " hi" does not — everything unmatched survives
    const out = applyMention("@Elar hi", 4, { start: 0, query: "Ela" }, "Elara Vance");
    expect(out.text).toBe("@Elara Vance hi");
  });

  it("absorbs a surname continuation when the query matched a name word", () => {
    // caret after "@Van" inside "@Vance" — "ce" continues the surname
    const out = applyMention("@Vance hi", 4, { start: 0, query: "Van" }, "Elara Vance");
    expect(out.text).toBe("@Elara Vance hi");
    expect(out.caret).toBe("@Elara Vance".length);
  });

  it("replaces a whole surname mention from a caret right after the @", () => {
    const out = applyMention("@Vance hi", 1, { start: 0, query: "" }, "Elara Vance");
    expect(out.text).toBe("@Elara Vance hi");
  });
});
