// Usage: bun board-bench2.ts <rows>
// Decomposes search cost and tests the "drained queue" in() case and a materialised current-state alternative.
import { Database } from "bun:sqlite";
import { rmSync } from "fs";
const N = +(process.argv[2] ?? 1000000);
const path = `${import.meta.dir}/b2-${N}.db`;
for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
const db = new Database(path);
db.run("PRAGMA journal_mode=WAL"); db.run("PRAGMA synchronous=NORMAL");
db.run(`CREATE TABLE datom (tx INTEGER PRIMARY KEY, e TEXT NOT NULL, a TEXT NOT NULL, v TEXT NOT NULL, m TEXT NOT NULL, op TEXT NOT NULL)`);
db.run("CREATE INDEX datom_ea ON datom(e, a)"); db.run("CREATE INDEX datom_av ON datom(a, v)");
db.run("CREATE VIRTUAL TABLE datom_fts USING fts5(e, a, v, content='datom', content_rowid='tx')");
db.run("CREATE TRIGGER datom_ai AFTER INSERT ON datom BEGIN INSERT INTO datom_fts(rowid,e,a,v) VALUES (new.tx,new.e,new.a,new.v); END");
// Alternative: current-state table with space as a real column, FTS over current only
db.run("CREATE TABLE cur (id INTEGER PRIMARY KEY, e TEXT, a TEXT, v TEXT, space TEXT, UNIQUE(e,a,v))");
db.run("CREATE INDEX cur_a ON cur(a, space)");
db.run("CREATE VIRTUAL TABLE cur_fts USING fts5(v, content='cur', content_rowid='id')");
db.run("CREATE TRIGGER cur_ai AFTER INSERT ON cur BEGIN INSERT INTO cur_fts(rowid,v) VALUES (new.id,new.v); END");
db.run("CREATE TRIGGER cur_ad AFTER DELETE ON cur BEGIN INSERT INTO cur_fts(cur_fts,rowid,v) VALUES ('delete',old.id,old.v); END");
// Zipf-ish vocabulary of 5000 words
const V = Array.from({ length: 5000 }, (_, i) => "w" + i.toString(36));
const zipf = () => V[Math.min(4999, Math.floor(Math.pow(Math.random(), 3) * 5000))];
const val = () => JSON.stringify(Array.from({ length: 20 }, zipf).join(" "));
const ins = db.prepare("INSERT INTO datom(e,a,v,m,op) VALUES (?,?,?,?,?)");
const insCur = db.prepare("INSERT OR IGNORE INTO cur(e,a,v,space) VALUES (?,?,?,?)");
const delCur = db.prepare("DELETE FROM cur WHERE e=? AND a=? AND v=?");
let t0 = performance.now();
const bulk = db.transaction((from: number, to: number) => {
  for (let i = from; i < to; i++) {
    const e = "e" + i, a = "a" + (i % 40), v = val(), sp = i % 10 === 0 ? "private:s" + (i % 7) : "public";
    ins.run(e, a, v, JSON.stringify({ space: sp, author: "p" + (i % 50) }), "assert");
    insCur.run(e, a, v, sp);
    if (i % 3 === 0) { ins.run(e, a, v, "{}", "retract"); delCur.run(e, a, v); } // a third of tuples are later consumed
  }
});
for (let i = 0; i < N; i += 10000) bulk(i, Math.min(N, i + 10000));
console.log(`loaded ${N} asserts (+${Math.ceil(N / 3)} retracts) in ${((performance.now() - t0) / 1000).toFixed(1)} s; file ${(Bun.file(path).size / 1e6).toFixed(0)} MB`);
const time = (label: string, st: any, args: any[], reps = 30) => {
  const xs: number[] = []; let n = 0;
  for (let i = 0; i < reps; i++) { const s = performance.now(); n = st.all(args[i % args.length]).length; xs.push(performance.now() - s); }
  xs.sort((a, b) => a - b);
  console.log(`${label}: p50=${xs[Math.floor(reps / 2)].toFixed(2)} ms p95=${xs[Math.floor(reps * .95)].toFixed(2)} ms rows=${n}`);
};
const common = [V[0], V[1], V[2]], rare = [V[3000], V[4000], V[4500]];
const qa = db.prepare("SELECT rowid FROM datom_fts WHERE datom_fts MATCH ? ORDER BY bm25(datom_fts) LIMIT 20");
const qb = db.prepare(`SELECT d.tx FROM datom_fts f JOIN datom d ON d.tx=f.rowid WHERE datom_fts MATCH ?
  AND json_extract(d.m,'$.space') IN ('public','private:s1') ORDER BY bm25(datom_fts) LIMIT 20`);
const qc = db.prepare(`SELECT d.tx FROM datom_fts f JOIN datom d ON d.tx=f.rowid WHERE datom_fts MATCH ?
  AND json_extract(d.m,'$.space') IN ('public','private:s1') AND d.op='assert'
  AND NOT EXISTS (SELECT 1 FROM datom r WHERE r.e=d.e AND r.a=d.a AND r.v=d.v AND r.op='retract' AND r.tx>d.tx)
  ORDER BY bm25(datom_fts) LIMIT 20`);
const qd = db.prepare(`SELECT c.id FROM cur_fts f JOIN cur c ON c.id=f.rowid WHERE cur_fts MATCH ?
  AND c.space IN ('public','private:s1') ORDER BY bm25(cur_fts) LIMIT 20`);
const qe = db.prepare(`SELECT c.id FROM cur_fts f JOIN cur c ON c.id=f.rowid WHERE cur_fts MATCH ?
  AND c.space IN ('public','private:s1') ORDER BY f.rank LIMIT 20`);
for (const [nm, terms] of [["common-term", common], ["rare-term", rare]] as const) {
  time(`${nm} (a) fts bm25 only`, qa, terms); time(`${nm} (b) +space json filter`, qb, terms);
  time(`${nm} (c) design.md search (space+not-retracted)`, qc, terms); time(`${nm} (d) current-table fts + space column`, qd, terms);
  time(`${nm} (e) current-table, ORDER BY rank`, qe, terms);
}
const cnt = db.prepare("SELECT count(*) n FROM datom_fts WHERE datom_fts MATCH ?");
console.log("matches common:", common.map(t => (cnt.get(t) as any).n), "rare:", rare.map(t => (cnt.get(t) as any).n));
// Drained queue: attribute "req/q" with 20k historical asserts, all consumed, then 1 open one at the end
const fill = db.transaction(() => { for (let i = 0; i < 20000; i++) { ins.run("q" + i, "req/q", '"x"', "{}", "assert"); ins.run("q" + i, "req/q", '"x"', "{}", "retract"); } ins.run("qopen", "req/q", '"x"', "{}", "assert"); });
fill();
const findOpen = db.prepare(`SELECT d.tx FROM datom d WHERE d.a=? AND d.op='assert'
   AND NOT EXISTS (SELECT 1 FROM datom r WHERE r.e=d.e AND r.a=d.a AND r.v=d.v AND r.op='retract' AND r.tx>d.tx) LIMIT 1`);
time("in()/rd() on drained queue of 20k consumed tuples (datom table)", findOpen, [["req/q"]], 20);
const findCur = db.prepare("SELECT id FROM cur WHERE a=? AND space='public' LIMIT 1");
time("rd() via current table", findCur, [["a1"]], 20);
db.close();
for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
