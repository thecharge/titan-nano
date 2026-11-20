# Installed acceptance on 2026-11-20

The Linux x86-64 check used Bun 1.3.10 and the installed Titan preview 0.1.0-alpha.1 outside the checkout. The runtime build was `d7b4dd77962d9ef8b679477c9320de00194b219a09db6861db4370b50d0a6136`.

| Check                  | Observed result                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First use              | Run `00473c15-f462-4d45-bd8d-82c134b68786` passed the shipped everyday problem workflow with scripted answers. Doctor reported Python, Lean and local model files missing and live checks did not run.           |
| Release discovery      | The installed command found synthetic tag `0.1.0-alpha.2` in a local Git source. The ordinary command kept valid JSON output and printed one update line to standard error.                                      |
| Disabled checks        | `update.check: never` returned `checked: false` and the ordinary command printed no update line. The offline test table also checks that disabled calls never query the source.                                  |
| Installed continuation | Run `26a7b49a-891d-4431-a217-eac35020293b` went from waiting to passed through the installed `titan resume`. the run, worker session, attempt number and bundle hash stayed the same. The worker executed twice. |

The installed Codex delivery run `0465bf20-5de4-448c-bf55-950d397ecd2a` proposed a packaged upgrade test. Its independent reviewer refuted the candidate because the live hub assertion could pass when the backup omitted the same fact. The run failed and Titan restored the source file. The coordinator extended the fixture to check home and project knowledge after both successful and rejected updates, then query a separate copy restored from the backup. The fixture also verifies the backup error message in rejected updates.

All four installed update cases passed in the offline package gate. The cases cover a successful switch, preservation of an earlier backup and rejection of two invalid staged doctor responses. The source update cases also exercise rollback after the launcher has switched. The packaged update cases run sequentially because they share the offline dependency cache.

The distribution contract still requires an isolated test registry with missing dependency and secret-package rejection, a native-load diagnostic on an unverified architecture, a supported data-format upgrade on a copy and live Claude acceptance. The installed preview probes use local archives and local fixtures. No release tag or registry publication was performed.
