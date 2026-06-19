/* Db port → @tauri-apps/plugin-sql (SQLite). The engine writes `?`
   placeholders (the portable style); SQLx-backed plugin-sql wants
   numbered `$1, $2, …`, so we translate. No SQL in the engine contains
   a literal `?`, so the swap is safe. */
import Database from "@tauri-apps/plugin-sql";
import type { Db, DbResult } from "@engine/ports";

function translate(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export class TauriDb implements Db {
  private constructor(private readonly db: Database) {}

  static async load(path = "sqlite:dragonheart.db"): Promise<TauriDb> {
    const db = await Database.load(path);
    return new TauriDb(db);
  }

  async execute(sql: string, params: unknown[] = []): Promise<DbResult> {
    const res = await this.db.execute(translate(sql), params);
    return { rowsAffected: res.rowsAffected, ...(res.lastInsertId != null ? { lastInsertId: res.lastInsertId } : {}) };
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.select<T[]>(translate(sql), params);
  }
}
