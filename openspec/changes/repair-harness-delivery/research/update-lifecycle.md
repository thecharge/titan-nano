# Update lifecycle implementation

Owning requirements are product tasks 31.12 and 33.9 in `resilient-agent-blackboard-bun`. The command now implements managed installation and automatic handoff alongside release discovery. The sections below retain the design contract. The implementation evidence section records what has been exercised and what remains open.

## Admission and ownership

Keep `titan update --check` read-only. Add installation through the installed `titan update` command, including `--from FILE`. Preserve the current release discovery policy. Add home-owned `update.mode` with `notify`, `auto` and `off`, defaulting to `notify`.

An update needs exclusive ownership spanning daemon admission, data backup, package staging, migrations and launcher switching. Reuse the existing kernel-held SQLite lease mechanism. A live owner blocks a second updater. A dead owner's durable transaction determines recovery. PID existence alone cannot establish ownership.

Coordinate this lease with server startup and normal CLI daemon discovery. A maintenance interval must prevent another command starting a writer between daemon shutdown and backup. Release checking alone must acquire no installation lease and create no files.

## Quiescent handoff

Inspect the actual server state under the maintenance lease. Automatic installation waits while work is active. Blocked runs can remain retained and recoverable. Preserve their creating runtime and keep its release available.

Close admission before draining existing requests. Drain queued mutations, then close native hosts, knowledge and run databases through the existing resource stack. The stop implementation now closes request admission synchronously and drains admitted handlers before pausing active work. Later dashboard and API requests receive HTTP 503 with `server_stopping`. Native tools remain available while workers pause. Focused actual-server cases retain an admitted submission across stop and restart, refuse later requests and drain validation failures.

The maintenance foundation now holds kernel-owned SQLite leases. An existing server remains available while an updater owns maintenance. Startup must acquire maintenance before writer ownership. An updater can acquire offline writer ownership only after the old server releases it. Actual process tests cover normal exit, SIGKILL, competing update ownership and competing server startup. They preserve the lease files and reacquire ownership after exit.

Owner-authenticated `POST /maintenance/stop` defaults to idle-only shutdown. It refuses active runs and earlier admitted requests. Explicit owner shutdown pauses active runs. Agent credentials cannot stop the server. The actual daemon observes shutdown completion and exits before a replacement starts. Version-bound discovery requires idle handoff before connecting through another release. Installation and automatic handoff now compose these primitives.

A successful new launcher must not silently reuse an older daemon. Extend health compatibility checks and handoff so commands reach the selected release while older pinned runs retain their compatible recovery route.

## Backup and transaction

Copy the whole Titan home and every affected project hub before mutation. Place the home backup under `backups/VERSION-TIME`. Exclude only the destination currently being created from its own traversal. Preserve earlier backups, credentials, permissions, symlink identities, configuration, runs and knowledge. Verify the readable copy and its manifest before moving forward.

Retain a durable transaction record with the old launcher identity, backup identity, staged release and current phase. Refuse a changed launcher or backup. On interruption, recover from the last durable phase before allowing another writer. A backup failure leaves active data and the launcher intact.

Install the package beside the old release. Run doctor from that exact staged executable. Apply supported migrations to copies while retaining original data. Switch only after package and data checks pass. A failure restores the previous active data and launcher, retains the backup and reports its path. Keep every earlier release needed by a retained run.

## Acceptance

- Use real installed commands for a successful local-package update and a package whose doctor fails.
- Verify runs, private proposals, journals, settings, credentials and project hubs before and after each outcome.
- Interrupt after backup, package installation, migration and launcher switching. Recover without duplicate migrations or worker dispatch.
- Race two updaters and a new daemon. Exactly one updater owns the transaction and no database writer enters during backup.
- Exercise automatic idle installation, active-run deferral, notify mode and off mode.
- Prove check-only mode creates no files, launches no daemon and performs no installation.
- Verify Codex and Claude registrations follow the stable launcher, and retained pinned runs can recover through their earlier runtime.

Full acceptance remains open. The focused cases below extend the existing registration continuity probe.

## Implementation evidence

The managed updater accepts a local archive or builds the selected source tag. It verifies the tag object, source manifest and packaged version. A mismatched packaged version refuses selection. Home configuration supports notify, auto and off modes while retaining older configuration hashes.

Installation owns the installation and home maintenance leases. Idle daemons drain and stop before backup. Active work defers automatic installation. Explicit force uses the owner pause path. The updater acquires offline writer ownership before reading the catalog or copying data.

Backups retain the whole home, earlier backups, affected project metadata and external run directories. Streamed hashes and source identities verify each copy and detect later source changes. Temporary staging sits outside every supplied root that contains the home. Nested home and project metadata paths therefore remain finite.

Durable transaction phases retain the earlier launcher, next launcher and verified backup manifest identity. Startup refuses an unfinished transaction. Recovery checks that identity before restoring the earlier launcher. Tests kill the updater after backup, package installation, validation and launcher switching. Damaged evidence and external launcher changes retain the recovery barrier.

Read-only SQLite catalog inspection initially changed shared-memory companion bytes in a verified backup. A repeated-verification case exposed this failure. Catalog inspection now opens a disposable copy of the database and its companions. Source files and retained backups remain available for repeated verification. Linked catalog files refuse inspection.

Focused session 26231 reported 131 behavioral passes and zero failures across four files. Those cases precede the later catalog-path guard and retained-history installation cases. The focused command exits one because the partial suite cannot satisfy complete product coverage. No complete coverage claim follows from that result.

Installed probe session 19494 exited zero for four self-contained package cases in the established offline container. It exercised successful selection, earlier backup retention, failed doctor and malformed doctor output. The probe compiled a second release version without changing repository manifests. These cases precede the later retained-journal and repeated-backup-inspection assertions. The first complete package run, session 4874, failed because the offline installation lacked a prepared dependency cache. A fresh-cache attempt timed out. The fixture now prepares cache entries from installed dependencies before the network-disabled acceptance run.

The complete installed acceptance in session 99178 exited zero, including four real two-version update cases, retained run journals and repeated backup inspection. It precedes the retained-runtime command routing below. Complete source session 88800 failed with 6,198 passes, one skip and two metadata fixture failures across 342 files in 593.12 seconds. It reported uncovered handoff and updater lines. Tree dbbcbbca5a3fd12e2d5aeef88f6b900bf5e4e984 and manifest /tmp/titan-updater-complete-source-identity.json identify that result. The metadata fixture now records the implemented update and backup options. This failure remains separate from later focused acceptance.

Run runtime mismatches now carry a structured required version through the server and client. Managed commands find retained releases, verify their manifests and actual executable versions, drain an idle owner, and hand off with an invocation pin. Current commands can subsequently select their own idle daemon. The pin suppresses automatic update and recursive handoff. Active work refuses switching. Missing, malformed, linked and mismatched releases preserve the original compatibility diagnostic.

Installed runtime probe session 36000 exited zero for four cases. Both successful updates repeatedly inspected the old run, switched back to the current daemon, and retained the stable launcher. The initial run was active when its fixture stopped. Its creating runtime therefore appended one expected restart event and blocked the interrupted run. Repeated recovery preserved that journal exactly. The initial probe incorrectly required an entirely unchanged journal after recovery. The corrected assertion verifies the retained prefix, exactly one restart event, unchanged creating runtime and no repeated event. An earlier probe used the nonexistent list command. The corrected command is runs.

Independent quality session 82159 passed all 18 commands. It precedes the latest handoff and admission case additions. Focused session 82003 observed 208 passes and zero behavioral failures across five files, then failed whole-product coverage because the selected suite is partial. Later admission and handoff cases require collection and a complete source rerun. A selection attempt used a nonexistent CLI test filename and refused before testing.

Supported data-format migrations still need copy migration and rollback. Later mixed creating-runtime catalog cases passed, including refusals for changed pins and unsupported future formats. CLI and MCP clients now share compatible-owner recovery with one retry. The newest source identities and installed package evidence are in the repair evidence record.

Bootstrap installation now uses the updater's ownMaintenance lease through tooling/scripts/bootstrap-install.ts. The public shell script still handles prerequisites and source dependency setup. The helper holds installation ownership across package build, staged installation, doctor and atomic launcher replacement. It retains earlier releases and disables package scripts. Terminated owners release their kernel-held SQLite lease. Legacy directory locks remain untouched and cannot block the new owner path.

The actual shell-entry fixtures execute the new helper with local build and package fixtures. Session 78821 passed all 23 bootstrap cases, including killed first installation, killed reinstall, concurrent ownership refusal and abandoned legacy lock. Its combined unused-tool suite failed because its miniature workspace lacked the newly registered tool entry. Adding that entry corrected the fixture. Session 6849 then observed 51 passes and zero behavioral failures across both files, with unique log /tmp/titan-bootstrap-focused-1794655446794.log. The focused command exited one for incomplete whole-product coverage. Later cleanup changes still need verification. Current full source session 95736 predates the bootstrap helper.

Shared-write enforcement, dynamic write-scope negotiation, supported copy migrations and complete current-source coverage remain open. No commit or push occurred.
