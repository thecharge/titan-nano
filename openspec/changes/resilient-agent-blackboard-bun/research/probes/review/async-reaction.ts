// Does bun:sqlite's db.transaction() keep an async reaction inside the transaction? (design.md line 96)
import { Database } from "bun:sqlite";
const db = new Database(":memory:");
db.run("CREATE TABLE datom (tx INTEGER PRIMARY KEY, a TEXT, v TEXT)");
const ins = db.prepare("INSERT INTO datom(a,v) VALUES (?,?)");
// sync reaction that throws -> rollback expected
const syncTx = db.transaction((v: string) => { ins.run("patch/diff", v); throw new Error("contract/pre missing"); });
try { syncTx("p1"); } catch (e: any) { console.log("sync reaction threw:", e.message); }
console.log("rows after sync veto:", (db.query("SELECT count(*) n FROM datom").get() as any).n);
// async reaction (e.g. a pre-condition that awaits a sandbox run or an LLM) that rejects
const asyncTx = db.transaction(async (v: string) => { ins.run("patch/diff", v); await Bun.sleep(5); throw new Error("async contract/pre missing"); });
let p: Promise<unknown> | undefined;
try { p = asyncTx("p2") as any; console.log("asyncTx returned:", Object.prototype.toString.call(p), "inTransaction right after:", db.inTransaction); }
catch (e: any) { console.log("asyncTx threw synchronously:", e.message); }
try { await p; } catch (e: any) { console.log("async rejection:", e.message); }
console.log("rows after async veto:", (db.query("SELECT count(*) n FROM datom").get() as any).n, "(1 means the vetoed write was COMMITTED)");
// cost of N sync JS reactions per write inside the txn
for (const R of [0, 10, 100]) {
  const reactions = Array.from({ length: R }, (_, i) => (a: string, v: string) => { if (a.startsWith("x" + i)) throw new Error(); });
  const tx = db.transaction((a: string, v: string) => { ins.run(a, v); for (const r of reactions) r(a, v); });
  const s = performance.now(); for (let i = 0; i < 20000; i++) tx("patch/diff", "v" + i);
  console.log(`reactions=${R}: ${((performance.now() - s) / 20000 * 1000).toFixed(1)} us per write`);
}
// reaction that runs a predicate query over the board (typical contract pre-condition)
const pre = db.prepare("SELECT 1 FROM datom WHERE a='falsify/survived' AND v=? LIMIT 1");
const txq = db.transaction((v: string) => { ins.run("patch/state", v); pre.get(v); });
let s = performance.now(); for (let i = 0; i < 20000; i++) txq("v" + i);
console.log(`1 reaction with unindexed predicate query, table ${(db.query("SELECT count(*) n FROM datom").get() as any).n} rows: ${((performance.now() - s) / 20000 * 1000).toFixed(1)} us per write (last batch)`);
