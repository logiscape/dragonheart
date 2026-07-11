/* Shared in-memory SQLite Db for engine tests, backed by node:sqlite.
   Loaded via a runtime require so Vite never tries to pre-resolve the
   builtin; returns null where node:sqlite isn't available (older Node
   without --experimental-sqlite) so suites can skipIf gracefully. */
import { createRequire } from "node:module";
import type { Db, DbResult } from "../ports";

export class NodeDb implements Db {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any) {}
  async execute(sql: string, params: unknown[] = []): Promise<DbResult> {
    const r = this.db.prepare(sql).run(...params);
    return { rowsAffected: Number(r.changes), lastInsertId: Number(r.lastInsertRowid) };
  }
  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
}

export function tryCreateNodeDb(): NodeDb | null {
  try {
    const req = createRequire(import.meta.url);
    const { DatabaseSync } = req("node:sqlite") as { DatabaseSync: new (p: string) => unknown };
    return new NodeDb(new DatabaseSync(":memory:"));
  } catch {
    return null;
  }
}

export function hasNodeSqlite(): boolean {
  try {
    const req = createRequire(import.meta.url);
    req("node:sqlite");
    return true;
  } catch {
    return false;
  }
}
