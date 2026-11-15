# Hive server probe

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

- `server.ts`: a small `titan` server. The board file holds one JSON line per event, and it is the truth. At start, the server rebuilds its state from the board. Fake agents return a result after 30 ms, and some of them add steps. A policy says, for each kind of step, who approves it: `auto`, `main` or `human`. Usage: `bun server.ts <board file> <port file> <token>`.
- `test.ts`: tries to break the server in 11 checks. Run `bun test.ts`. Output: `test-output.txt`, and `test-output-rerun.txt` from a second run. Both say "11 passed, 0 failed".
- `control.ts`: turns off one safeguard at a time, to show that the test can fail. Output: `control-output.txt`. With the version check off, two answers to one request both win. With the state in memory only, a crash loses all steps.

A gap that the test found: a step that was running when the server stopped runs again after the restart.
