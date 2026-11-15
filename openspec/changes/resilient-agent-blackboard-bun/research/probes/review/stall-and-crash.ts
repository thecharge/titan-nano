// (1) event-loop stall caused by one synchronous bun:sqlite search; (2) claim-then-crash orphan with design.md in() semantics.
import { Database } from "bun:sqlite";
import { rmSync } from "fs";
const mode = process.argv[2] ?? "stall";
const path = `${import.meta.dir}/crash.db`;
if (mode === "stall") {
  const db = new Database(":memory:");
  db.run("CREATE VIRTUAL TABLE f USING fts5(v)");
  const ins = db.prepare("INSERT INTO f(v) VALUES (?)");
  const w = "build test patch lint failure timeout config parser module".split(" ");
  db.transaction(() => { for (let i = 0; i < 300000; i++) ins.run(Array.from({ length: 12 }, () => w[i * 7 % 9 ^ (Math.random() * 9 | 0)] ?? "x").join(" ")); })();
  // a 10 ms heartbeat timer stands in for LLM stream handling, sandbox timeouts and MCP keepalives
  let last = performance.now(), worst = 0;
  const h = setInterval(() => { const n = performance.now(); worst = Math.max(worst, n - last - 10); last = n; }, 10);
  await Bun.sleep(50);
  const s = performance.now(); db.query("SELECT rowid FROM f WHERE f MATCH 'parser' ORDER BY bm25(f) LIMIT 20").all(); const q = performance.now() - s;
  await Bun.sleep(50); clearInterval(h);
  console.log(`search took ${q.toFixed(0)} ms; worst 10ms-timer lateness during it: ${worst.toFixed(0)} ms (event loop blocked)`);
} else if (mode === "crash-setup") {
  for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
  const db = new Database(path); db.run("PRAGMA journal_mode=WAL");
  db.run("CREATE TABLE datom (tx INTEGER PRIMARY KEY, e TEXT, a TEXT, v TEXT, m TEXT, op TEXT)");
  db.run("INSERT INTO datom(e,a,v,m,op) VALUES ('c1','continuation/step','{\"next\":\"write-patch\"}','{}','assert')");
  // in(): BEGIN IMMEDIATE, retract + claim (design.md:93)
  db.transaction(() => { db.run("INSERT INTO datom(e,a,v,m,op) VALUES ('c1','continuation/step','{\"next\":\"write-patch\"}','{}','retract')");
    db.run("INSERT INTO datom(e,a,v,m,op) VALUES ('c1','claim/by','\"persona-7\"','{}','assert')"); }).immediate();
  console.log("claimed c1; now crashing before the LLM call returns"); process.exit(137);
} else {
  const db = new Database(path);
  const open = db.query(`SELECT d.e FROM datom d WHERE d.a='continuation/step' AND d.op='assert' AND NOT EXISTS
     (SELECT 1 FROM datom r WHERE r.e=d.e AND r.a=d.a AND r.v=d.v AND r.op='retract' AND r.tx>d.tx)`).all();
  const claims = db.query("SELECT e, v FROM datom WHERE a='claim/by'").all();
  console.log("after restart: unclaimed continuations =", JSON.stringify(open), "| claims =", JSON.stringify(claims), "-> work is orphaned: no lease/expiry in design.md");
  db.close(); for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
}
