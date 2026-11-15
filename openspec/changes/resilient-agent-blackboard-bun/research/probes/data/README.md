# Data probes

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10. Each is one run, not a benchmark.

- `append.ts`: 8 processes each add 2000 JSON lines of about 330 bytes to one file. Output: `append-output.txt`, 16000 lines and 0 broken.
- `sqlw-first-try.ts`: 8 processes each change one SQLite row 300 times, with `busy_timeout` set after `journal_mode=wal`. Output: `sqlw-first-try-output.txt`, 7 processes stopped with `SQLITE_BUSY`.
- `sqlw.ts`: the same, with `busy_timeout=5000` set first and a version check on each change. Output: `sqlw-output.txt`, final version 2400 of 2400.
