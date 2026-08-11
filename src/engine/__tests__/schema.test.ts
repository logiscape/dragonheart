/* The v2 migration: per-character models become opt-in overrides, so the
   hearth's "Underlying mind" (settings.defaultModel) governs every 1:1 turn.
   Verified against a scripted Db fake — v1 ships no sqlite test adapter. */
import { describe, it, expect } from "vitest";
import { initSchema, SCHEMA_VERSION } from "../db/schema";
import type { Db, DbResult } from "../ports";
import { starterCharacters } from "../seed";

/** Records every execute; answers the schema_version select from a script. */
class FakeDb implements Db {
  executed: { sql: string; params: unknown[] }[] = [];
  constructor(private storedVersion: string | null) {}

  async execute(sql: string, params: unknown[] = []): Promise<DbResult> {
    this.executed.push({ sql, params });
    return { rowsAffected: 0 };
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    void params;
    if (sql.includes("FROM meta")) {
      return (this.storedVersion === null
        ? []
        : [{ value: this.storedVersion }]) as T[];
    }
    return [];
  }
}

describe("schema v2 migration", () => {
  it("clears baked-in character models when upgrading from v1", async () => {
    const db = new FakeDb("1");
    await initSchema(db);
    expect(
      db.executed.some((e) => /UPDATE character SET default_model = ''/.test(e.sql)),
    ).toBe(true);
    const bump = db.executed.find((e) => e.sql.includes("UPDATE meta"));
    expect(bump?.params).toEqual([String(SCHEMA_VERSION), "schema_version"]);
  });

  it("records the current version on a fresh database without migrating", async () => {
    const db = new FakeDb(null);
    await initSchema(db);
    const insert = db.executed.find((e) => e.sql.includes("INSERT INTO meta"));
    expect(insert?.params).toEqual(["schema_version", String(SCHEMA_VERSION)]);
    expect(db.executed.some((e) => e.sql.includes("UPDATE character"))).toBe(false);
  });

  it("is idempotent once at the current version", async () => {
    const db = new FakeDb(String(SCHEMA_VERSION));
    await initSchema(db);
    expect(db.executed.some((e) => e.sql.includes("UPDATE character"))).toBe(false);
    expect(db.executed.some((e) => e.sql.includes("UPDATE meta"))).toBe(false);
  });
});

describe("starterCharacters", () => {
  it("bakes in no models, so starters always follow the hearth settings", () => {
    for (const c of starterCharacters()) {
      expect(c.defaultModel, c.name).toBeNull();
      expect(c.fastModel, c.name).toBeNull();
    }
  });
});
