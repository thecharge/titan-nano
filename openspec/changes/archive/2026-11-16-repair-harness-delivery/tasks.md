## 1. Record the repair baseline

- [x] 1.1 Record the starting revision, unfinished changes, observed failures and task ownership in `evidence.md`; preserve the existing working tree.
- [x] 1.2 Reopen contradicted completion claims in the product tasks and acceptance map; link each to a failing case or source evidence.
- [x] 1.3 Register every repair acceptance scenario in the repository scenario checker with honest pending status; prove missing mappings fail.

## 2. Make execution safe

- [x] 2.1 Reproduce concurrent-edit loss during rollback with shared case tables, covering retained edits, creation, deletion and refusal; link product task 33.12.
- [x] 2.2 Repair restoration to preserve concurrent user changes and report conflicts; pass the rollback cases and document any remaining host race limitation.
- [x] 2.3 Coordinate shared live file scopes across runs through durable board intent, automatic yielding and retry; negotiate changed scope and external edits without silently overwriting them; pass contention, cancellation and protected-path cases for tasks 33.12 and 33.19.
- [x] 2.4 Repair snapshot handling of disappearing files and changing SQLite companion files; pass concurrent-change and interrupted-run cases for task 33.12.
- [x] 2.5 Verify backend authorization across start, retry, limits, resume and restart; prove no unapproved vendor dispatch for task 33.15.

## 3. Complete production workflow services

- [x] 3.1 Wire approved script execution into production server composition using existing process services; pass actual-server check failure and retry cases for tasks 22.8, 22.10 and 33.13.
- [x] 3.2 Wire project and home knowledge into production runs; pass actual-server read, write and lesson cases for tasks 33.1 and 33.2.
- [x] 3.3 Review and complete the preserved journal implementation; pass success, failure, cancellation and unavailable-hub cases for the existing journal requirements.
- [x] 3.4 Prove journals and knowledge survive restart and are consumed by a later workflow; retain evidence through installed CLI acceptance.

## 4. Complete installation and visible features

- [x] 4.1 Repair the installed knowledge probe against the intended scope contract; pass `bun run check:package` without dropping behavioral assertions.
- [x] 4.2 Finish the installed launcher and tool checks; pass clean-install and missing-tool acceptance for distribution tasks 31.9 and the existing launcher requirement.
- [x] 4.3 Finish embedding-model setup and offline reuse; pass install, missing-model and meaning-search acceptance for task 33.5.
- [x] 4.4 Finish dashboard knowledge visibility and persisted run inspection; pass mapped dashboard cases and record screenshots under repository docs for tasks 33.3 and 33.14.

## 5. Retain and complete the remaining product scope

- [x] 5.1 Classify every remaining product task as applicable to Claude Code and Codex or explicitly deferred for another backend; record dependencies without removing requirements.
- [x] 5.2 Expand each remaining applicable feature into session-sized implementation tasks in the owning product backlog; preserve its acceptance scenarios and execute in dependency order.
- [x] 5.3 Verify Claude Code and Codex adapters against pinned primary documentation and strict offline vendor contracts; leave paid live-call proof pending until explicitly authorized.

## 6. Verify delivery

- [x] 6.1 Run focused acceptance for each repaired production behavior and record source identity, commands, outcomes and limits in `evidence.md`.
- [x] 6.2 Run complete local verification, installed-package acceptance and independent documentation checks; record every failure without bypassing hooks or coverage.
- [x] 6.3 Run strict OpenSpec and release completeness checks; keep readiness blocked while any applicable requirement or required live proof is pending.
