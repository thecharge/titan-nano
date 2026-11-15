import { Database } from "bun:sqlite";
const db = new Database("kb.db"); db.run("pragma journal_mode=wal"); db.run("pragma busy_timeout=5000");
db.run("create table if not exists entry(id text primary key, version int, body text)");
db.run("insert or ignore into entry values ('e1', 0, '')");
let conflicts = 0;
for (let i = 0; i < 300; i++) {
  // optimistic update: only succeeds if version is unchanged since read
  for (;;) {
    const row = db.query("select version from entry where id='e1'").get() as any;
    const r = db.run("update entry set version=?, body=? where id='e1' and version=?", [row.version + 1, process.argv[2], row.version]);
    if (r.changes === 1) break; conflicts++;
  }
}
console.log("writer", process.argv[2], "conflicts retried", conflicts);
