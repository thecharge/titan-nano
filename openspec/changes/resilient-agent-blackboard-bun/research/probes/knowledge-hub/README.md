# Knowledge hub probes

Run on 2026-11-05 on Linux x86-64 with Bun 1.3.10.

- `probe.ts`: loads `sqlite-vec` into `bun:sqlite`, makes a vec0 table with 3 rows and asks for the 2 nearest. Output in `probe-output.txt`: vec_version v0.1.9; nearest rows 1 (distance 0) and 3 (distance 0.141).
- `embed.ts`: makes embeddings with `@huggingface/transformers` and the model `Xenova/all-MiniLM-L6-v2`. Output in `embed-output.txt`: 384 numbers per text; similarity 0.604 between "check time zones first" and "the clock is in UTC"; 0.056 between "check time zones first" and "plan a cheap move"; 19307 ms for the first run, including the model download.
- Bun blocked 2 postinstall scripts when `@huggingface/transformers` was installed. The probe still ran.
- These are single runs, not benchmarks.
- `fts.ts`: makes an SQLite word search table (FTS5) in `bun:sqlite` with 3 entries and searches "time zones". Output in `fts-output.txt`: one match, `l1`, with the matching words marked: "Check [time] [zones] first when tests fail at...". This needs no extension and no model.
