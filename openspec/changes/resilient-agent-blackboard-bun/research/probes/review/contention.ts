// Usage: bun contention.ts <procs> <writesPerProc> <busyTimeoutMs> <holdMs>
// Spawns <procs> OS processes; each does single-datom BEGIN IMMEDIATE writes against one WAL file.
// holdMs simulates synchronous work (a reaction) done while the write lock is held.
import { Database } from "bun:sqlite";
import { rmSync } from "fs";
const [, , role, ...rest] = process.argv;
const path = `${import.meta.dir}/contention.db`;
if (role !== "child") {
  const P = +(role ?? 4), W = +(rest[0] ?? 500), BT = +(rest[1] ?? 5000), HOLD = +(rest[2] ?? 0);
  for (const s of ["", "-wal", "-shm"]) rmSync(path + s, { force: true });
  const db = new Database(path); db.run("PRAGMA journal_mode=WAL");
  db.run("CREATE TABLE datom (tx INTEGER PRIMARY KEY, e TEXT, a TEXT, v TEXT, m TEXT, op TEXT)"); db.close();
  const t0 = performance.now();
  const kids = Array.from({ length: P }, (_, i) => Bun.spawn(["bun", import.meta.path, "child", String(i), String(W), String(BT), String(HOLD)], { stdout: "pipe" }));
  const outs = await Promise.all(kids.map(k => new Response(k.stdout).json()));
  const wall = performance.now() - t0;
  const lat = outs.flatMap((o: any) => o.lat).sort((a: number, b: number) => a - b);
  const busy = outs.reduce((s: number, o: any) => s + o.busy, 0), ok = outs.reduce((s: number, o: any) => s + o.ok, 0);
  const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]?.toFixed(2);
  console.log(`procs=${P} writes/proc=${W} busy_timeout=${BT}ms hold=${HOLD}ms -> ok=${ok} SQLITE_BUSY=${busy} wall=${(wall / 1000).toFixed(2)}s throughput=${(ok / (wall / 1000)).toFixed(0)} tx/s lat p50=${q(.5)} p99=${q(.99)} max=${lat.at(-1)?.toFixed(1)} ms`);
} else {
  const [id, W, BT, HOLD] = rest.map(Number);
  const db = new Database(path); db.run(`PRAGMA busy_timeout=${BT}`); db.run("PRAGMA synchronous=NORMAL");
  const ins = db.prepare("INSERT INTO datom(e,a,v,m,op) VALUES (?,?,?,?,'assert')");
  const tx = db.transaction((i: number) => { ins.run(`p${id}-${i}`, "a", "v", "{}"); if (HOLD) Bun.sleepSync(HOLD); });
  const lat: number[] = []; let busy = 0, ok = 0;
  for (let i = 0; i < W; i++) {
    const s = performance.now();
    try { tx.immediate(i); ok++; lat.push(performance.now() - s); } catch (e: any) { if (String(e.message).includes("locked") || e.code === "SQLITE_BUSY") busy++; else throw e; }
  }
  console.log(JSON.stringify({ lat, busy, ok }));
}
