import { Database } from "bun:sqlite";
const db = new Database(":memory:");
db.run(`CREATE TABLE datom (tx INTEGER PRIMARY KEY, e TEXT NOT NULL, a TEXT NOT NULL, v TEXT NOT NULL, m TEXT NOT NULL, op TEXT NOT NULL CHECK (op IN ('assert','retract')))`);
db.run(`CREATE VIRTUAL TABLE datom_fts USING fts5(e, a, v, content='datom', content_rowid='tx')`);
const ins = db.prepare("INSERT INTO datom(e,a,v,m,op) VALUES (?,?,?,?,?)");
const count = () => (db.query("select count(*) c from datom").get() as any).c;
// 1. sync reaction throwing
const write1 = db.transaction((r: () => void) => { ins.run("p1","patch/diff",'"x"',"{}","assert"); r(); });
try { write1(() => { throw new Error("no contract/pre"); }); } catch (e: any) { console.log("sync reaction threw:", e.message); }
console.log("rows after sync throw:", count());
// 2. async reaction throwing
const write2 = db.transaction((r: () => Promise<void>) => { ins.run("p2","patch/diff",'"y"',"{}","assert"); return r(); });
try { const p = write2(async () => { await 0; throw new Error("async veto"); }); await p.catch((e:any)=>console.log("async reaction rejected later:", e.message)); } catch (e: any) { console.log("async threw sync:", e.message); }
console.log("rows after async throw:", count(), JSON.stringify(db.query("select e from datom").all()));
// 3. custom SQL functions?
console.log("db.function:", typeof (db as any).function, "db.loadExtension:", typeof (db as any).loadExtension);
// 4. FTS external content without triggers
ins.run("e9","note",'"hello world"',"{}","assert");
console.log("fts match w/o triggers:", JSON.stringify(db.query("select rowid from datom_fts where datom_fts match 'hello'").all()));
db.run("INSERT INTO datom_fts(datom_fts) VALUES('rebuild')");
console.log("fts match after rebuild:", JSON.stringify(db.query("select rowid from datom_fts where datom_fts match 'hello'").all()));
// 5. tx per row not per transaction
const two = db.transaction(() => { ins.run("t1","x",'1',"{}","retract"); ins.run("t1","claim",'"p"',"{}","assert"); });
two(); console.log("tx ids of two writes in one transaction:", JSON.stringify(db.query("select tx,e,a,op from datom where e='t1'").all()));
// 6. update/delete not prevented
db.run("UPDATE datom SET v='\"tampered\"' WHERE e='e9'"); db.run("DELETE FROM datom WHERE e='t1'");
console.log("after update+delete:", count());
// 7. Linda multiset: out same tuple twice with content address
const h = (s:string)=>new Bun.CryptoHasher("sha256").update(s).digest("hex").slice(0,8);
console.log("content ids of two identical outs:", h('{"a":"task","v":"x"}'), h('{"a":"task","v":"x"}'));
