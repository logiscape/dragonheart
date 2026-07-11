/* ============================================================
   Dragon Heart — SQLite schema.
   The engine owns the data model. Schema is created idempotently
   at boot (CREATE TABLE IF NOT EXISTS) and versioned through the
   `meta` table so later migrations can run forward. Arrays and the
   Soul Document are stored as JSON text; embeddings as JSON arrays
   (brute-force cosine in TS — see vector.ts).
   ============================================================ */

import type { Db } from "../ports";

export const SCHEMA_VERSION = 3;

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS user (
     id                TEXT PRIMARY KEY,
     display_name      TEXT NOT NULL,
     default_persona_id TEXT,
     created_at        INTEGER NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS persona (
     id          TEXT PRIMARY KEY,
     user_id     TEXT NOT NULL,
     name        TEXT NOT NULL,
     profile     TEXT NOT NULL DEFAULT '',
     is_default  INTEGER NOT NULL DEFAULT 0,
     created_at  INTEGER NOT NULL,
     updated_at  INTEGER NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS character (
     id               TEXT PRIMARY KEY,
     name             TEXT NOT NULL,
     epithet          TEXT NOT NULL DEFAULT '',
     blurb            TEXT NOT NULL DEFAULT '',
     soul             TEXT NOT NULL,              -- JSON SoulDocument
     first_message    TEXT NOT NULL DEFAULT '',
     greeting_dropcap INTEGER NOT NULL DEFAULT 1,
     default_model    TEXT NOT NULL,
     fast_model       TEXT,
     mood             TEXT NOT NULL DEFAULT 'ember',
     status           TEXT NOT NULL DEFAULT 'present',
     avatar_path      TEXT,
     traits           TEXT NOT NULL DEFAULT '[]', -- JSON string[]
     voice_preset     TEXT NOT NULL DEFAULT 'Warm',
     thinking         INTEGER NOT NULL DEFAULT 0,
     created_at       INTEGER NOT NULL,
     updated_at       INTEGER NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS relationship (
     id                  TEXT PRIMARY KEY,
     user_id             TEXT NOT NULL,
     character_id        TEXT NOT NULL,
     profile             TEXT NOT NULL DEFAULT '',
     persona_id          TEXT,
     model_override      TEXT,
     memory_depth        TEXT NOT NULL DEFAULT 'season',
     proactive_allowed   INTEGER NOT NULL DEFAULT 0,
     show_inner_monologue INTEGER NOT NULL DEFAULT 0,
     allow_topic_change  INTEGER NOT NULL DEFAULT 1,
     mood                TEXT,
     affect              TEXT,                     -- carried feeling, model-written
     created_at          INTEGER NOT NULL,
     updated_at          INTEGER NOT NULL,
     UNIQUE (user_id, character_id)
   )`,

  `CREATE TABLE IF NOT EXISTS lore (
     id            TEXT PRIMARY KEY,
     scope         TEXT NOT NULL,                 -- 'character' | 'relationship'
     owner_id      TEXT NOT NULL,
     keys          TEXT NOT NULL DEFAULT '[]',    -- JSON string[]
     content       TEXT NOT NULL DEFAULT '',
     enabled       INTEGER NOT NULL DEFAULT 1,
     case_sensitive INTEGER NOT NULL DEFAULT 0,
     embedding     TEXT,                          -- JSON number[] | null
     created_at    INTEGER NOT NULL,
     updated_at    INTEGER NOT NULL
   )`,

  // NOTE: rooms reuse this table (kind='room'); relationship_id is then the
  // empty-string sentinel '' — mapped to null in repositories.ts, never a UUID.
  `CREATE TABLE IF NOT EXISTS conversation (
     id            TEXT PRIMARY KEY,
     relationship_id TEXT NOT NULL,
     kind          TEXT NOT NULL DEFAULT 'direct',   -- 'direct' | 'room'
     title         TEXT,
     scene_state   TEXT,
     started_at    INTEGER NOT NULL,
     updated_at    INTEGER NOT NULL,
     last_summary_through_message_id TEXT
   )`,

  `CREATE TABLE IF NOT EXISTS conversation_participant (
     conversation_id TEXT NOT NULL,
     character_id    TEXT NOT NULL,
     joined_at       INTEGER NOT NULL,
     left_at         INTEGER,                        -- NULL = currently present
     talkativeness   REAL NOT NULL DEFAULT 0.5,
     PRIMARY KEY (conversation_id, character_id)
   )`,

  `CREATE TABLE IF NOT EXISTS message (
     id              TEXT PRIMARY KEY,
     conversation_id TEXT NOT NULL,
     role            TEXT NOT NULL,
     content         TEXT NOT NULL,
     attachments     TEXT NOT NULL DEFAULT '[]',  -- JSON Attachment[]
     speaker_character_id TEXT,                   -- room assistant turns only
     tokens          INTEGER NOT NULL DEFAULT 0,
     created_at      INTEGER NOT NULL,
     summarized      INTEGER NOT NULL DEFAULT 0
   )`,

  // NOTE: room-scoped summaries use relationship_id='' + room_id set.
  `CREATE TABLE IF NOT EXISTS memory (
     id                 TEXT PRIMARY KEY,
     relationship_id    TEXT NOT NULL,
     room_id            TEXT,                     -- provenance: born in this room
     content            TEXT NOT NULL,
     kind               TEXT NOT NULL DEFAULT 'fact',
     keys               TEXT NOT NULL DEFAULT '[]',
     embedding          TEXT,
     salience           REAL NOT NULL DEFAULT 0.5,
     source_message_ids TEXT NOT NULL DEFAULT '[]',
     pinned             INTEGER NOT NULL DEFAULT 0,
     enabled            INTEGER NOT NULL DEFAULT 1,
     created_at         INTEGER NOT NULL,
     updated_at         INTEGER NOT NULL,
     last_recalled_at   INTEGER
   )`,

  `CREATE INDEX IF NOT EXISTS idx_message_conv ON message (conversation_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_rel ON memory (relationship_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_room ON memory (room_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lore_owner ON lore (scope, owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_rel ON conversation (relationship_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_kind ON conversation (kind, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_participant_char ON conversation_participant (character_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rel_user_char ON relationship (user_id, character_id)`,
];

/**
 * Create the schema if absent and record the version. Safe to call on every
 * boot. Future schema changes append migration blocks keyed on the stored
 * version.
 */
export async function initSchema(db: Db): Promise<void> {
  // meta first, so the stored version can be read before anything else runs
  await db.execute(STATEMENTS[0]!);
  const rows = await db.select<{ value: string }>(
    `SELECT value FROM meta WHERE key = ?`,
    ["schema_version"],
  );

  // Forward migrations, keyed on the stored version. These must run BEFORE the
  // base statements: the idempotent CREATE INDEX lines below reference columns
  // (e.g. memory.room_id) that only the ALTERs add to a pre-existing table.
  if (rows.length > 0) {
    let version = Number(rows[0]!.value) || 1;
    if (version < 2) {
      // v2: carried emotional state on the relationship
      await db.execute(`ALTER TABLE relationship ADD COLUMN affect TEXT`);
      version = 2;
    }
    if (version < 3) {
      // v3: group rooms — room conversations, speaker attribution, room memory
      await db.execute(
        `ALTER TABLE conversation ADD COLUMN kind TEXT NOT NULL DEFAULT 'direct'`,
      );
      await db.execute(`ALTER TABLE message ADD COLUMN speaker_character_id TEXT`);
      await db.execute(`ALTER TABLE memory ADD COLUMN room_id TEXT`);
      version = 3;
    }
    if (version !== Number(rows[0]!.value)) {
      await db.execute(`UPDATE meta SET value = ? WHERE key = ?`, [
        String(version),
        "schema_version",
      ]);
    }
  }

  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
  if (rows.length === 0) {
    await db.execute(`INSERT INTO meta (key, value) VALUES (?, ?)`, [
      "schema_version",
      String(SCHEMA_VERSION),
    ]);
  }
}
