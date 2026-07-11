/* Schema v3 migration + room repositories, against in-memory node:sqlite.
   Skips gracefully where node:sqlite is unavailable. */
import { describe, it, expect, beforeEach } from "vitest";
import { initSchema, SCHEMA_VERSION } from "../db/schema";
import { Repos } from "../db/repositories";
import type { Clock } from "../ports";
import { hasNodeSqlite, tryCreateNodeDb, type NodeDb } from "./nodeDb";

function testClock(): Clock {
  let t = 1000;
  return { now: () => ++t };
}

/* The v2 schema as it shipped (before rooms), for migration tests. */
const V2_DDL = [
  `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE user (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, default_persona_id TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE persona (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '', is_default INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE character (id TEXT PRIMARY KEY, name TEXT NOT NULL, epithet TEXT NOT NULL DEFAULT '', blurb TEXT NOT NULL DEFAULT '', soul TEXT NOT NULL, first_message TEXT NOT NULL DEFAULT '', greeting_dropcap INTEGER NOT NULL DEFAULT 1, default_model TEXT NOT NULL, fast_model TEXT, mood TEXT NOT NULL DEFAULT 'ember', status TEXT NOT NULL DEFAULT 'present', avatar_path TEXT, traits TEXT NOT NULL DEFAULT '[]', voice_preset TEXT NOT NULL DEFAULT 'Warm', thinking INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE relationship (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '', persona_id TEXT, model_override TEXT, memory_depth TEXT NOT NULL DEFAULT 'season', proactive_allowed INTEGER NOT NULL DEFAULT 0, show_inner_monologue INTEGER NOT NULL DEFAULT 0, allow_topic_change INTEGER NOT NULL DEFAULT 1, mood TEXT, affect TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE (user_id, character_id))`,
  `CREATE TABLE lore (id TEXT PRIMARY KEY, scope TEXT NOT NULL, owner_id TEXT NOT NULL, keys TEXT NOT NULL DEFAULT '[]', content TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, case_sensitive INTEGER NOT NULL DEFAULT 0, embedding TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE conversation (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL, title TEXT, scene_state TEXT, started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_summary_through_message_id TEXT)`,
  `CREATE TABLE message (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]', tokens INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, summarized INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE memory (id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL, content TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'fact', keys TEXT NOT NULL DEFAULT '[]', embedding TEXT, salience REAL NOT NULL DEFAULT 0.5, source_message_ids TEXT NOT NULL DEFAULT '[]', pinned INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_recalled_at INTEGER)`,
];

describe.skipIf(!hasNodeSqlite())("schema v3 migration", () => {
  it("migrates a v2 database in place, keeping direct conversations readable", async () => {
    const db = tryCreateNodeDb()!;
    for (const sql of V2_DDL) await db.execute(sql);
    await db.execute(`INSERT INTO meta (key, value) VALUES ('schema_version', '2')`);
    await db.execute(
      `INSERT INTO conversation (id, relationship_id, title, scene_state, started_at, updated_at) VALUES ('c1','r1',NULL,NULL,1,1)`,
    );
    await db.execute(
      `INSERT INTO message (id, conversation_id, role, content, created_at) VALUES ('m1','c1','assistant','hello',1)`,
    );
    await db.execute(
      `INSERT INTO memory (id, relationship_id, content, created_at, updated_at) VALUES ('mem1','r1','tea',1,1)`,
    );

    await initSchema(db);

    const version = await db.select<{ value: string }>(
      `SELECT value FROM meta WHERE key = 'schema_version'`,
    );
    expect(version[0]!.value).toBe(String(SCHEMA_VERSION));

    const repos = new Repos(db, testClock());
    const conv = await repos.getConversation("c1");
    expect(conv?.kind).toBe("direct");
    expect(conv?.relationshipId).toBe("r1");
    const msgs = await repos.listMessages("c1");
    expect(msgs[0]?.speakerCharacterId).toBeNull();
    const mems = await repos.listMemories("r1");
    expect(mems[0]?.roomId).toBeNull();
    // the participant table exists and is queryable
    expect(await repos.listParticipants("c1")).toEqual([]);
  });

  it("is idempotent — initSchema can run on every boot", async () => {
    const db = tryCreateNodeDb()!;
    await initSchema(db);
    await initSchema(db);
    const version = await db.select<{ value: string }>(
      `SELECT value FROM meta WHERE key = 'schema_version'`,
    );
    expect(version[0]!.value).toBe(String(SCHEMA_VERSION));
  });
});

describe.skipIf(!hasNodeSqlite())("room repositories", () => {
  let db: NodeDb;
  let repos: Repos;

  beforeEach(async () => {
    db = tryCreateNodeDb()!;
    await initSchema(db);
    repos = new Repos(db, testClock());
  });

  it("creates and lists room conversations with a null relationshipId", async () => {
    const room = await repos.createRoomConversation("The Hearth", "Around the fire.");
    expect(room.kind).toBe("room");
    expect(room.relationshipId).toBeNull();
    expect(room.title).toBe("The Hearth");

    const rooms = await repos.listRoomConversations();
    expect(rooms.map((r) => r.id)).toEqual([room.id]);
    // direct-conversation queries never see rooms ('' matches no real id)
    expect(await repos.listConversations("some-relationship")).toEqual([]);
  });

  it("adds, removes, and re-admits participants (soft leave)", async () => {
    const room = await repos.createRoomConversation("The Hearth");
    await repos.addParticipant(room.id, "char-a");
    await repos.addParticipant(room.id, "char-b");
    expect((await repos.listParticipants(room.id)).map((p) => p.characterId)).toEqual([
      "char-a",
      "char-b",
    ]);

    await repos.removeParticipant(room.id, "char-a");
    expect((await repos.listParticipants(room.id)).map((p) => p.characterId)).toEqual(["char-b"]);
    const all = await repos.listParticipants(room.id, true);
    expect(all.find((p) => p.characterId === "char-a")?.leftAt).not.toBeNull();

    await repos.addParticipant(room.id, "char-a");
    expect((await repos.listParticipants(room.id)).map((p) => p.characterId).sort()).toEqual([
      "char-a",
      "char-b",
    ]);
  });

  it("stores speaker attribution on messages", async () => {
    const room = await repos.createRoomConversation("The Hearth");
    await repos.addMessage({
      conversationId: room.id,
      role: "assistant",
      content: "The lamp is steady tonight.",
      attachments: [],
      speakerCharacterId: "char-a",
      tokens: 0,
      summarized: false,
    });
    const msgs = await repos.listMessages(room.id);
    expect(msgs[0]?.speakerCharacterId).toBe("char-a");
  });

  it("scopes room summaries away from relationship memories", async () => {
    const room = await repos.createRoomConversation("The Hearth");
    await repos.createMemory({
      relationshipId: null,
      roomId: room.id,
      content: "The three of them talked about the storm.",
      kind: "summary",
      keys: [],
      embedding: null,
      salience: 0.55,
      sourceMessageIds: [],
      pinned: false,
      enabled: true,
    });
    await repos.createMemory({
      relationshipId: "rel-a",
      roomId: room.id,
      content: "Tester fears storms.",
      kind: "fact",
      keys: ["storm"],
      embedding: null,
      salience: 0.6,
      sourceMessageIds: [],
      pinned: false,
      enabled: true,
    });

    const summary = await repos.latestRoomSummary(room.id);
    expect(summary?.content).toContain("storm");
    expect(summary?.relationshipId).toBeNull();

    // the room summary never appears in a relationship's memory list
    const relMems = await repos.listEnabledMemories("rel-a");
    expect(relMems).toHaveLength(1);
    expect(relMems[0]?.kind).toBe("fact");
    expect(await repos.latestSummary("rel-a")).toBeNull();
  });

  it("deleteConversation removes participants and room summaries, keeps bond memories", async () => {
    const room = await repos.createRoomConversation("The Hearth");
    await repos.addParticipant(room.id, "char-a");
    await repos.createMemory({
      relationshipId: null,
      roomId: room.id,
      content: "room summary",
      kind: "summary",
      keys: [],
      embedding: null,
      salience: 0.5,
      sourceMessageIds: [],
      pinned: false,
      enabled: true,
    });
    await repos.createMemory({
      relationshipId: "rel-a",
      roomId: room.id,
      content: "bond memory born in the room",
      kind: "fact",
      keys: [],
      embedding: null,
      salience: 0.5,
      sourceMessageIds: [],
      pinned: false,
      enabled: true,
    });

    await repos.deleteConversation(room.id);
    expect(await repos.listParticipants(room.id, true)).toEqual([]);
    expect(await repos.latestRoomSummary(room.id)).toBeNull();
    expect(await repos.listMemories("rel-a")).toHaveLength(1);
  });
});
