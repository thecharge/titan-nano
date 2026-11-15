// A fake RunPod serverless queue endpoint, built from the rules in RunPod's docs (sources O14 to O16):
// /run returns a job id with status IN_QUEUE; /status returns the job; /cancel stops it (CANCELLED).
// policy.executionTimeout ends a job that runs too long (TIMED_OUT). policy.ttl counts from submission;
// when it ends, the job is removed and /status returns 404. No live RunPod endpoint was used.
// Time runs SCALE times faster, so that 1 hour takes 3.6 s when SCALE is 1000.
export const SCALE = 1000;
type Job = { id: string; status: string; input: any; submitted: number; started?: number; timer?: Timer; output?: any };

export function startFakeRunpod(key: string, opts: { queueMs: number | ((input: any) => number); jobMs: (input: any) => number }) {
  const jobs = new Map<string, Job>();
  const cancelled: string[] = []; // "<job id> <status before cancel>" for each cancel call
  let n = 0;
  const now = () => Date.now() * SCALE; // fake clock in RunPod milliseconds
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    async fetch(req) {
      if (req.headers.get("authorization") !== key) return new Response("unauthorized", { status: 401 });
      const m = new URL(req.url).pathname.match(/^\/v2\/[^/]+\/(run|status|cancel)(?:\/(.+))?$/);
      if (!m) return new Response("not found", { status: 404 });
      const [, op, id] = m;
      if (op === "run") {
        const b = await req.json();
        const exec = b.policy?.executionTimeout ?? 600000, ttl = b.policy?.ttl ?? 86400000;
        if (exec < 5000 || ttl < 10000) return Response.json({ error: "executionTimeout min 5 s, ttl min 10 s" }, { status: 400 });
        const job: Job = { id: `job-${++n}`, status: "IN_QUEUE", input: b.input, submitted: now() };
        jobs.set(job.id, job);
        setTimeout(() => jobs.delete(job.id), ttl / SCALE); // ttl ends: job removed, even while running
        setTimeout(() => {
          if (job.status !== "IN_QUEUE") return;
          job.status = "IN_PROGRESS"; job.started = now();
          const need = opts.jobMs(job.input);
          job.timer = setTimeout(() => {
            if (job.status !== "IN_PROGRESS") return;
            if (need > exec) job.status = "TIMED_OUT"; else { job.status = "COMPLETED"; job.output = { text: `done ${job.input.step}` }; }
          }, Math.min(need, exec) / SCALE);
        }, (typeof opts.queueMs === "function" ? opts.queueMs(b.input) : opts.queueMs) / SCALE);
        return Response.json({ id: job.id, status: job.status });
      }
      const job = jobs.get(id ?? "");
      if (!job) return new Response("job not found", { status: 404 });
      if (op === "cancel") { cancelled.push(`${job.id} ${job.status}`); if (job.status === "IN_QUEUE" || job.status === "IN_PROGRESS") { job.status = "CANCELLED"; clearTimeout(job.timer); } }
      return Response.json({ id: job.id, status: job.status, output: job.output });
    },
  });
  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true), jobs, cancelled, now };
}
