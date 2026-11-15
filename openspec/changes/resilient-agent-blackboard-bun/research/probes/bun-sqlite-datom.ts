import { Database } from "bun:sqlite";
const db = new Database(":memory:");
db.run("create table datoms(e text,a text,v text,t integer,m text)");
db.run("insert into datoms values (?,?,?,?,?)", ["e1","status","open",1,"{}"]);
console.log(Bun.version, JSON.stringify(db.query("select * from datoms").all()));
