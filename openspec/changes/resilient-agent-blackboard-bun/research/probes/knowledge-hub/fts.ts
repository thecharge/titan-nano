import { Database } from "bun:sqlite";
const db = new Database(":memory:");
db.run("create virtual table kb using fts5(id, kind, title, body)");
const ins = db.prepare("insert into kb values (?,?,?,?)");
ins.run("p1","persona","skeptic","Tries to prove a claim wrong with a counter example.");
ins.run("l1","lesson","time zones","Check time zones first when tests fail at midnight.");
ins.run("f1","fact","rent in Sofia","A one-room flat costs about 600 EUR a month.");
console.log(db.query("select id, title, snippet(kb, 3, '[', ']', '...', 8) as why, bm25(kb) as score from kb where kb match ? order by score").all("time zones"));
