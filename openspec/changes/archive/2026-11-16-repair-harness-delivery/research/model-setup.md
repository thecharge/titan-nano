# Local model preparation

Reviewed on 2026-11-13. Task 4.3 remains open. Initial dependency evidence is followed by the integration status below.

The primary [model revision API](https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2) and its [pinned tree](https://huggingface.co/api/models/Xenova/all-MiniLM-L6-v2/tree/751bff37182d3f1213fa05d7196b954e230abad9?recursive=true&expand=false) identify revision `751bff37182d3f1213fa05d7196b954e230abad9`. Six public artifacts were downloaded to `/tmp/titan-model-setup`. Their total size is 23,916,680 bytes. The quantized weight digest matches the primary tree's LFS digest. The smaller artifact digests below were measured from the pinned downloads.

| Artifact                                                                                                                                       | Bytes    | SHA-256                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `config.json`                                                                                                                                  | 650      | `7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7` |
| [quantized weights](https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/751bff37182d3f1213fa05d7196b954e230abad9/onnx/model_quantized.onnx) | 22972370 | `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1` |
| `special_tokens_map.json`                                                                                                                      | 125      | `b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3` |
| `tokenizer.json`                                                                                                                               | 711661   | `da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0` |
| `tokenizer_config.json`                                                                                                                        | 366      | `9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3` |
| `vocab.txt`                                                                                                                                    | 231508   | `07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3` |

Pinned Transformers 4.3.2 source under `packages/embedder-local/node_modules/@huggingface/transformers/src/utils/hub.js` supports explicit `local_files_only`, revision and cache settings. Absolute local model paths cannot become valid remote model identifiers. Its data type utility defaults to full precision on this host; quantized setup must explicitly select `q8`. Do not download one format while silently asking runtime for another.

An independent probe used the actual SDK and model in network-disabled, read-only Podman, with the model mounted at `/model`. A controlled loader passed `local_files_only: true` and `q8` to the SDK pipeline. Titan's actual local embedder, knowledge hub and vector index then found the related lesson in meaning mode. The probe passed one test with three assertions in 536 milliseconds. Log: `/tmp/titan-model-offline-probe.log`; probe source: `/tmp/titan-model-offline-probe.test.ts`. This probe is not registered product acceptance and does not exercise install, doctor or default runtime cache selection.

Complete task 4.3 by implementing explicit install and doctor ports, reporting name and size before fetching, supporting `--no-model` and `doctor --fetch-model`, validating pinned cached artifacts, and using only the selected local model during normal runtime. Add shared positive and negative cases and installed acceptance. Default doctor must neither import the SDK pipeline nor download. Repeat real offline meaning search through the installed CLI before checking the task. Do not close the real-model requirement from the earlier skipped gate or this narrower compatibility probe.

## Implemented integration and remaining acceptance

The product now has install and doctor cache ports. The workspace cache validates the six pinned artifacts and publishes downloads only after digest and exact size checks. The adapter accepts a typed cache interface; runtime composes it for server and project CLI knowledge. Cached initialization can retry after missing files or SDK failure. The built-in configured alias resolves to the current revision identity, preserving explicit reindex requirements.

`bun run test:prepare` prepares the pinned public model in the repository dependency cache. Offline tests and installed-package checks consume that cache without fetching. The real model test is now required rather than skipped by default. Shared cases cover cache reuse, corruption, short and oversized downloads, invalid digests, HTTP failure, absent bodies and unsafe links. CLI cases verify notice ordering, explicit fetch, skip and inspect-only behavior. Focused offline verification passed 24 cases with 141 assertions.

First installed acceptance failed because the archive omitted dynamically loaded SDK and vector dependencies. Declaring both exposed a second blocker: the client accepts only word-mode responses. That validation still needs a focused repair and negative fixtures. Task 4.3 remains open until replacement installed acceptance and complete coverage pass. Source-only SDK compatibility does not close it.

## Completed model batch

The client now validates requested meaning and combined modes, fallback warnings, identity, paths and score shape. The installed archive includes the pinned Transformers and vector dependencies. Replacement source verification passed 5,400 tests with one skipped, no failures and complete coverage of 441 product TypeScript sources. Installed acceptance passed with archive SHA-256 `7d6b1b3218e17f10d558eff36e7a322b4a7d33271f79bce2a2c3b7314d349981`. Both outcomes were observed before closing repair item 4.3. Logs and source identity are recorded in the evidence document. Subsequent dashboard readiness changes need their own verification.
