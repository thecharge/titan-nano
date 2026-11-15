// Tries to break the 1-hour limit for a run on RunPod, against the fake endpoint. Usage: bun test.ts
import { startFakeRunpod } from "./fake-runpod";
import { RunClock, RunpodQueue, checkLimit, MAX_RUN_MS } from "./deadline";

const out: string[] = [];
const check = (name: string, ok: boolean, detail: string) => { out.push(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); console.log(out.at(-1)); };
const KEY = "fake-key";
const min = (ms: number) => `${(ms / 60000).toFixed(1)} min`;

// 1. Short jobs finish, and every job is sent with limits no longer than the time left.
{
  const rp = startFakeRunpod(KEY, { queueMs: 20000, jobMs: () => 300000 });
  const clock = new RunClock(MAX_RUN_MS, rp.now), q = new RunpodQueue(rp.url, KEY, clock);
  const res = await Promise.all(["a", "b", "c"].map((s) => q.runStep(s)));
  const ok = q.sent.every((x) => x.ttl <= MAX_RUN_MS && x.executionTimeout <= MAX_RUN_MS);
  check("short jobs finish inside the hour", res.every((x) => x === "COMPLETED") && ok, `statuses ${res.join(", ")}; largest ttl sent ${min(Math.max(...q.sent.map((x) => x.ttl)))}`);
  rp.stop();
}
// 2. A job that needs 2 hours is stopped by RunPod at the time left in the run.
{
  const rp = startFakeRunpod(KEY, { queueMs: 1000, jobMs: () => 7200000 });
  const clock = new RunClock(MAX_RUN_MS, rp.now), q = new RunpodQueue(rp.url, KEY, clock);
  const start = rp.now(); const s = await q.runStep("long"); const took = rp.now() - start;
  check("a 2-hour job ends by the deadline", took <= MAX_RUN_MS + 60000 && s !== "COMPLETED", `status ${s} after ${min(took)}`);
  rp.stop();
}
// 3. At the deadline, a job still in the queue and a job still running are both cancelled.
{
  // "queued" waits 70 min for a worker; "running" starts after 1 min and needs 2 hours.
  const rp = startFakeRunpod(KEY, { queueMs: (i) => (i.step === "queued" ? 4200000 : 60000), jobMs: () => 7200000 });
  const clock = new RunClock(MAX_RUN_MS, rp.now), q = new RunpodQueue(rp.url, KEY, clock);
  const res = await Promise.all([q.runStep("queued"), q.runStep("running")]);
  await Bun.sleep(20);
  const c = rp.cancelled;
  check("open jobs are cancelled at the deadline", res.every((x) => x === "timed_out") && c.length === 2 && c.some((x) => x.endsWith("IN_QUEUE")) && c.some((x) => x.endsWith("IN_PROGRESS")) && q.open.size === 0, `titan: ${res.join(", ")}; cancel calls with the status before: ${c.join("; ") || "none"}`);
  rp.stop();
}
// 4. With 35 s left (under 10 s once the 30 s margin is taken off), titan does not send the job at all.
{
  const rp = startFakeRunpod(KEY, { queueMs: 0, jobMs: () => 1000 });
  const clock = new RunClock(35000, rp.now), q = new RunpodQueue(rp.url, KEY, clock);
  const s = await q.runStep("late");
  check("no job is sent with under 10 s left", s === "timed_out" && q.sent.length === 0 && rp.jobs.size === 0, `status ${s}, ${q.sent.length} jobs sent`);
  rp.stop();
}
// 5. A workflow file that asks for 90 minutes is refused before anything starts.
{
  const e = checkLimit(90);
  check("a 90-minute limit is refused", e !== null && checkLimit(60) === null, `${e}`);
}
// 6. Wrong key.
{
  const rp = startFakeRunpod(KEY, { queueMs: 0, jobMs: () => 1000 });
  const r = await fetch(`${rp.url}/v2/ep/run`, { method: "POST", headers: { authorization: "wrong" }, body: "{}" });
  check("wrong key is refused", r.status === 401, `status ${r.status}`);
  rp.stop();
}
console.log(`${out.filter((x) => x.startsWith("PASS")).length} passed, ${out.filter((x) => x.startsWith("FAIL")).length} failed`);

// Control: the same 2-hour job, with the deadline turned off. RunPod's default execution timeout is 10 minutes,
// so the job is stopped at 10 minutes; with a large timeout set by hand, it would run past the hour.
{
  const rp = startFakeRunpod(KEY, { queueMs: 1000, jobMs: () => 7200000 });
  const clock = new RunClock(MAX_RUN_MS, rp.now), q = new RunpodQueue(rp.url, KEY, clock, false);
  const start = rp.now(); const s = await q.runStep("long"); const took = rp.now() - start;
  console.log(`CONTROL no deadline, RunPod defaults: status ${s} after ${min(took)}`);
  rp.stop();
}
{
  const rp = startFakeRunpod(KEY, { queueMs: 1000, jobMs: () => 7200000 });
  const clock = new RunClock(MAX_RUN_MS, rp.now);
  const q = new RunpodQueue(rp.url, KEY, clock, false);
  (q as any).call = function (path: string, body?: any) { // send a 3-hour execution timeout, as a careless caller might
    if (body) body.policy = { executionTimeout: 10800000, ttl: 10800000 };
    return fetch(`${rp.url}/v2/ep/${path}`, { method: body || path.startsWith("cancel") ? "POST" : "GET", headers: { authorization: KEY, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  };
  const start = rp.now(); const s = await q.runStep("long"); const took = rp.now() - start;
  console.log(`CONTROL no deadline, 3-hour timeout sent: status ${s} after ${min(took)}`);
  rp.stop();
}
