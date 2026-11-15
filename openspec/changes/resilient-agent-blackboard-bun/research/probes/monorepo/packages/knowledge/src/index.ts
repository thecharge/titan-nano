import { Database } from "bun:sqlite";
import { dirname, join } from "node:path";
import * as sqliteVec from "sqlite-vec";
export function check() {
  const db = new Database(":memory:");
  db.run("create virtual table w using fts5(t)");
  let vec = "not loaded";
  try { sqliteVec.load(db); vec = (db.query("select vec_version() v").get() as any).v + " (package)"; }
  catch { try { db.loadExtension(join(dirname(process.execPath), "vec0")); vec = (db.query("select vec_version() v").get() as any).v + " (next to binary)"; }
          catch (e) { vec = "error: " + (e as Error).message; } }
  return { fts5: "ok", vec };
}
