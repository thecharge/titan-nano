# Guide output verification

Piping `titan guide` could cut the output short even though the process exited successfully. The CLI now waits for plain-text output to drain. The integration regression starts the CLI as a separate process and reads its pipe.

Titan verification run `96624a16-adcd-4cbc-bcf0-03313e0b5d76` passed on Codex. The verifier and independent reviewer each checked the complete embedded schema against `titan schema`, all four guide examples, and the rule for work that must run in sequence. A guide-only preview archive was built and its entry point emitted the same guide bytes as the source CLI using the existing pinned dependencies. The host offline container passed the guide integration suite.

This closes tasks 12.1 and 21.4. Task 30.4 still needs reference generation and invocation checks from the shared argument definitions. Task 30.7 still needs a dashboard case that shows a timed retry alongside completed work and verifies that the wait neither counts as a refutation nor loses recorded usage.
