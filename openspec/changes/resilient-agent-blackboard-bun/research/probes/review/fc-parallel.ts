// Usage: bun fc-parallel.ts <parallel> <rounds>
// Restores the existing probe snapshot <parallel> times concurrently and measures process-start -> first new guest heartbeat.
// Snapshot artefacts: ../fc/snap.vmstate, ../fc/snap.mem (made by research/probes/firecracker-snapshot.sh).
import { mkdtempSync, rmSync, existsSync } from "fs";
const FC = `${import.meta.dir}/../fc`;
const P = +(process.argv[2] ?? 4), R = +(process.argv[3] ?? 3);
async function restoreOnce(): Promise<{ load: number; first: number; rssKb: number }> {
  const d = mkdtempSync(`/tmp/fcp-`); const sock = `${d}/api.sock`;
  const t0 = performance.now();
  const p = Bun.spawn(["firecracker", "--api-sock", sock], { stdout: "pipe", stderr: "pipe" });
  { const dl = performance.now() + 3000; while (!existsSync(sock)) { if (performance.now() > dl) throw new Error("no socket"); await Bun.sleep(1); } }
  let seen = false; let first = 0;
  const reader = (async () => { const dec = new TextDecoder(); for await (const c of p.stdout) { if (!seen && dec.decode(c).includes("HB")) { seen = true; first = performance.now() - t0; } } })();
  const res = await fetch("http://localhost/snapshot/load", { unix: sock, method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ snapshot_path: `${FC}/snap.vmstate`, mem_backend: { backend_type: "File", backend_path: `${FC}/snap.mem` }, enable_diff_snapshots: false, resume_vm: true }) } as any);
  const load = performance.now() - t0;
  if (res.status !== 204) throw new Error("load failed " + res.status + " " + await res.text());
  const deadline = performance.now() + 5000; while (!seen && performance.now() < deadline) await Bun.sleep(1);
  await Bun.sleep(200); // let the guest touch memory for RSS reading
  const status = await Bun.file(`/proc/${p.pid}/status`).text(); const rssKb = +(status.match(/VmRSS:\s+(\d+)/)?.[1] ?? 0);
  p.kill(); await p.exited; rmSync(d, { recursive: true, force: true });
  return { load, first: seen ? first : NaN, rssKb };
}
const all: { load: number; first: number; rssKb: number }[] = [];
for (let r = 0; r < R; r++) all.push(...await Promise.all(Array.from({ length: P }, restoreOnce)));
const f = all.map(x => x.first).sort((a, b) => a - b), l = all.map(x => x.load).sort((a, b) => a - b);
const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(xs.length * p))].toFixed(0);
console.log(`parallel=${P} n=${all.length}: load+resume p50=${q(l, .5)} p95=${q(l, .95)} max=${q(l, 1)} ms | first-HB p50=${q(f, .5)} p95=${q(f, .95)} max=${q(f, 1)} ms | RSS per VM ~${(all.reduce((s, x) => s + x.rssKb, 0) / all.length / 1024).toFixed(0)} MiB`);
