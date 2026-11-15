# RunPod probe: a run of at most 1 hour

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10. `RUNPOD_API_KEY` was not set, so no live RunPod endpoint was called.

- `fake-runpod.ts`: a fake RunPod queue endpoint, built from RunPod's docs (sources O14 to O16). It has `/run`, `/status` and `/cancel`, the job states IN_QUEUE, IN_PROGRESS, COMPLETED, CANCELLED and TIMED_OUT, and the `executionTimeout` and `ttl` rules. Its clock runs 1000 times faster, so 1 hour takes 3.6 s.
- `deadline.ts`: the part of a `titan` RunPod backend that keeps a run inside 1 hour. Each job gets an `executionTimeout` and a `ttl` no longer than the time left. `titan` cancels open jobs 30 s before the deadline. The 30 s is a guess that has not been measured.
- `test.ts`: 6 checks and 2 control runs. Run `bun test.ts`. Output: `test-output.txt`, "6 passed, 0 failed".
- `adapter.ts`: a model call to a private RunPod vLLM endpoint through `@ai-sdk/openai-compatible`. It was only type-checked. Output: `tsc-output.txt`, "tsc exit 0". Versions: `versions.txt`.

Two failures came before the final run:

1. The check "open jobs are cancelled at the deadline" first passed on an empty list. The `ttl` had already removed both jobs, so `titan` never cancelled them. The check now counts the cancel calls.
2. With the `ttl` equal to the time left, RunPod removes the job at the same moment as the deadline, so `titan` cannot cancel it first. This is why `titan` now cancels 30 s before the deadline. RunPod's docs do not say whether a worker stops when the `ttl` removes its job.
