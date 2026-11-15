import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
const db = new Database(":memory:");
sqliteVec.load(db);
console.log(db.query("select vec_version() as v").get());
db.run("create virtual table items using vec0(embedding float[3])");
const ins = db.prepare("insert into items(rowid, embedding) values (?, ?)");
ins.run(1, new Float32Array([1, 0, 0])); ins.run(2, new Float32Array([0, 1, 0])); ins.run(3, new Float32Array([0.9, 0.1, 0]));
console.log(db.query("select rowid, distance from items where embedding match ? order by distance limit 2").all(new Float32Array([1, 0, 0])));
