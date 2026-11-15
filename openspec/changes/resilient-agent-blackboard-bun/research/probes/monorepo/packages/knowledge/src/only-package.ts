import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
const db = new Database(":memory:");
sqliteVec.load(db);
console.log((db.query("select vec_version() v").get() as any).v);
