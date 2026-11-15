## ADDED Requirements

### Requirement: titan serve runs a local server

`titan serve` SHALL start an HTTP server with `Bun.serve` on 127.0.0.1 only, on a free port. It MUST write the port and the _agent token_ to `~/.titan/server.json`, and the _person token_ to `~/.titan/person-token`. Both files MUST have mode 600, so other operating-system users cannot read them. This does not separate agents running as the same user. A token is a long random string that a client sends with each call.

Startup MUST release its acquired lock, database and listener when settings, database setup or address publication fails. Shutdown MUST share one completion across concurrent callers. Calling shutdown again after another server starts MUST preserve that server's address and ownership lock.

#### Scenario: Server starts

- **WHEN** `titan serve` starts
- **THEN** `~/.titan/server.json` holds the port and the agent token, with mode 600
- **AND** the server does not answer on any address other than 127.0.0.1

#### Scenario: Failed startup can be retried

- **WHEN** startup fails during settings validation, database opening or address publication
- **THEN** its acquired database handles and listener are closed and its home lock is released
- **AND** fixing the failed input lets a new server execute a workflow

#### Scenario: Repeated shutdown preserves the next owner

- **WHEN** shutdown is called concurrently and then called again after another server starts in the same home
- **THEN** the concurrent calls share one completion
- **AND** the later server retains its address and lock and can execute a workflow

### Requirement: The server refuses calls without a token or from a web page

Except for the agent card route and the dashboard routes below, the server MUST refuse a call without a valid token with HTTP status 401. It MUST refuse a call whose `Origin` header names a web page with HTTP status 403. This keeps web pages in the person's browser from calling the server.

#### Scenario: No token

- **WHEN** a client calls `GET /runs` without a token
- **THEN** the server answers with status 401

#### Scenario: Foreign web page

- **WHEN** a call with a valid token has the header `Origin: https://example.com`
- **THEN** the server answers with status 403

### Requirement: The server has routes for runs, events, requests and steps

The server SHALL offer these routes, each with JSON bodies:

- `POST /runs`: start a run from a workflow file;
- `GET /runs` and `GET /runs/<run id>`: list runs and show one;
- `GET /runs/<run id>/events`: the board as server-sent events;
- `GET /requests`: the open requests of all runs;
- `POST /requests/<request id>/answer`: answer a request, as in spec approvals;
- `POST /runs/<run id>/steps`: add steps, as in spec hive-collaboration;
- `POST /runs/<run id>/cancel`: stop a run;
- `POST /runs/<run id>/pause` and `POST /runs/<run id>/resume`: checkpoint or continue a run;
- `GET /runs/<run id>/artifacts` and `GET /runs/<run id>/artifacts/<artifact id>`: inspect kept artifacts;
- `POST /runs/<run id>/artifacts/<artifact id>/export`: export to an approved local destination;
- `POST /runs/<run id>/apply`: preview or apply an approved diff;
- `GET /config` and `PUT /config`: inspect or atomically change authorized settings.

Event requests with `Accept: application/json` MUST return a bounded cursor page. `Accept: text/event-stream` MUST retain replayable server-sent events. Mutations MUST validate expected versions and idempotency keys before execution. MCP MUST expose equivalent typed operations, not infer target ids from active sessions.

_Server-sent events_ is a web standard that sends a stream of events over one HTTP answer.

#### Scenario: One unreadable run leaves other runs visible

- **WHEN** one indexed run has a corrupt or unreadable journal and another run is healthy
- **THEN** the run list retains both identities, marks only the unreadable row as read_unavailable with a diagnostic, and keeps the healthy run queryable
- **AND** a missing initial journal remains visible as initialization_incomplete
- **AND** clients reject malformed summary rows rather than accepting an unknown state or missing identity

#### Scenario: Initial background write failure is contained

- **WHEN** a newly started run fails its journal append or projection write
- **THEN** the shared background handler catches the execution rejection and the affected run cannot acknowledge pending state
- **AND** another submission on the same engine completes and remains visible
- **AND** an ordinary operational stop blocks its logical attempt without a quality refutation

#### Scenario: JSON event pages stay bounded

- **WHEN** a CLI, HTTP or MCP client reads committed events using an explicit run id, after cursor and page limit
- **THEN** each page returns events in order, next_cursor and has_more, without retaining complete run snapshots or the whole journal
- **AND** following next_cursor returns every later committed event once
- **AND** pages obey the central count and byte limits, oversized single events fail explicitly, invalid selectors fail and a future cursor receives status 409 over HTTP
- **AND** this JSON paging scenario does not establish live server-sent event replay

#### Scenario: Start a run over HTTP

- **WHEN** a client calls `POST /runs` with the agent token and the path of `examples/code-fix.yaml`
- **THEN** the answer holds a run id
- **AND** `GET /runs/<run id>` shows the run with the state `running` or `passed`

### Requirement: A client that reconnects gets the events it missed

Each event SHALL have an id. When a client reconnects with the header `Last-Event-ID`, the server MUST send later committed events in order. Client deduplication MUST provide once-only processing after a connection loss.

#### Scenario: Reconnect during a run

- **WHEN** a client reads 5 events, loses the connection, and reconnects with `Last-Event-ID` of the fifth event while the run makes 10 more
- **THEN** the client gets those 10 events in order, with no gaps and no duplicates

### Requirement: The board is the truth

The server SHALL rebuild each run's state from its `board.jsonl` and immutable files named by board entries. Entries MUST include the resolved plan, backend choices, run folder, working folder, deadline, answers and kept result paths. `events.jsonl` MUST be a view made from board entries, with the same event ids. An acknowledged state change MUST be flushed to durable storage before success is returned. Only one server writer MUST own a `TITAN_HOME` at a time. A step that was running when the server stopped MUST recover under the attempt, action and deadline rules of spec workflow-run. Recovery MUST NOT reset its attempt allowance. The board MUST get a `step_restarted` line identifying the preserved logical attempt, checkpoint and new execution segment.

#### Scenario: Restart from a different folder

- **WHEN** the server restarts from another working folder after a run kept one result
- **THEN** the run uses its recorded project folder, resolved backends and kept result
- **AND** that result's agent does not run again

#### Scenario: Torn last board line

- **WHEN** a crash leaves an incomplete final line in `board.jsonl`
- **THEN** restart discards that unacknowledged tail and replays all complete entries
- **AND** an invalid line before the tail stops recovery with an error and the board stays unchanged

#### Scenario: External state waits for a durable write

- **WHEN** a state transition is queued for a run and a client asks for its state
- **THEN** the response waits for already queued journal and projection writes and returns a detached committed snapshot
- **AND** a failed append or projection cannot return a successful acknowledgment for the pending state
- **AND** event inspection stops at the committed version captured for that request
- **AND** after an explicit reload the journal remains authoritative even if the earlier projection failed

#### Scenario: Process death releases writer ownership

- **WHEN** an operating-system process kills the daemon after a completed run
- **THEN** a new daemon acquires ownership without removing the persistent lease file
- **AND** the run reloads unchanged and receives a fresh server address

#### Scenario: Ownership metadata is removed while the daemon lives

- **WHEN** a second starter cannot find the first daemon's ownership metadata
- **THEN** the held operating-system lease still refuses the second writer

#### Scenario: Brief reader contention does not abandon startup

- **WHEN** a reader releases the lease database within the bounded 250 ms claim wait
- **THEN** startup can acquire exclusive ownership and publish its address
- **AND** a reader retained beyond that wait is refused without publishing a second writer

#### Scenario: Two servers for one home

- **WHEN** a second server starts with the same `TITAN_HOME`
- **THEN** it exits with code 2 before accepting writes

### Requirement: Recovery does not repeat an uncertain external action

Before an approved external action starts, `titan` SHALL write a durable action id and its approved scope to the board. It MUST write the outcome after completion. After a crash between those writes, the action MUST become `unknown` and wait for the person to reconcile it. A rerun MUST NOT reuse the old approval. This is not a promise that arbitrary SDK tools are isolated from the host. Each released backend MUST prove that its permission path routes external actions through this check.

#### Scenario: Crash after an external action

- **WHEN** an approved push finishes but the server crashes before recording its outcome
- **THEN** restart marks the action `unknown` and asks the person to reconcile it
- **AND** no second push starts automatically

#### Scenario: Server restarts during a run

- **WHEN** the server is killed while step `fix` runs, and then starts again
- **THEN** `GET /runs/<run id>` shows the same steps as before the kill
- **AND** the board has a `step_restarted` line for the same logical attempt of `fix`, or a recoverable blocked record when recovery cannot proceed

### Requirement: The command-line tool is a client of the server

`titan run`, `titan resume`, `titan answer`, `titan approve`, `titan deny` and `titan requests` SHALL call the server. When no server runs, these commands MUST start one in the background first. They MUST keep the exit codes and JSON output of spec backend-selection.

#### Scenario: No server running

- **WHEN** no server runs and the main agent runs `titan run examples/code-fix.yaml`
- **THEN** a server starts and `~/.titan/server.json` exists
- **AND** the run's events are printed as with a running server

#### Scenario: Background startup preserves ordinary run output

- **WHEN** a scripted example runs from a fresh home without a manually started server
- **THEN** an authenticated detached owner starts and the ordinary watched run returns its final result and result path
- **AND** repeated submissions reuse that owner and retain distinct run ids and comparable logical results

#### Scenario: Concurrent startup converges on one owner

- **WHEN** two local clients connect concurrently to the same empty home
- **THEN** both connect to the same ready owner through the existing SQLite lease
- **AND** losing startup children exit without replacing the winning owner

#### Scenario: Failed startup is bounded and reaped

- **WHEN** a child fails to start, exits early or cannot become ready within the configured deadline
- **THEN** the command returns transport exit 4 and reaps its own failed startup child
- **AND** an expired initial probe cannot launch another child
- **AND** startup_timeout_ms accepts positive integers up to the built-in 5000 ms ceiling

#### Scenario: Invalid work cannot start a daemon

- **WHEN** an offline run supplies a malformed answer script in a fresh home
- **THEN** the CLI exits 2 before creating the home, server or run

#### Scenario: Readiness requires bounded authenticated health

- **WHEN** discovery points to the local owner with or without a trailing slash
- **THEN** the client authenticates its health request and validates the shared response schema
- **AND** absent, unauthorized, empty, malformed, invalid or oversized responses cannot report readiness
- **AND** health reads stay within the address-byte limit and remaining startup deadline

### Requirement: titan mcp gives agent tools a way in

`titan mcp` SHALL be a tool server that the agent tools start, as in spec main-agent-guide. Its tools MUST call the server with the agent token. Every tool MUST return at once and MUST NOT wait for an answer from the main agent or the person.

#### Scenario: Main agent starts a run from its tool

- **WHEN** the main agent calls the tool `titan_run` of `titan mcp` with a workflow file
- **THEN** the tool returns a run id within 1 s
- **AND** the run goes on after the tool has returned

#### Scenario: Malformed MCP submission acknowledgement

- **WHEN** the run server returns an invalid active or settled run snapshot to titan_run
- **THEN** the MCP tool returns an error and supplies no accepted run
- **AND** valid assigned run ids retain their state through the shared typed client

### Requirement: The server shows an agent card

The server SHALL answer `GET /.well-known/agent-card.json` with an _agent card_: a JSON file in the form of the A2A (Agent2Agent) protocol, version 1.0, that says what `titan` can do. Apart from dashboard login with its one-time code, this route MUST be the only route that returns data without a token or dashboard cookie. The card MUST name `titan`, the server's address on 127.0.0.1, and the skill `run-workflow`. It MUST NOT hold a token or a key. The other A2A routes are not part of this change, as in `research/swarm.md`.

#### Scenario: Card without a token

- **WHEN** a client calls `GET /.well-known/agent-card.json` without a token
- **THEN** the server answers with status 200 and a card with `"name":"titan"` and a skill with `"id":"run-workflow"`
- **AND** the card holds neither the agent token nor the person token

### Requirement: The server serves the dashboard routes with a cookie

The server SHALL serve the dashboard of spec run-dashboard on its own port. The dashboard routes are `/`, `/login`, `/ui/api/runs`, `/ui/api/runs/<run id>` and `/ui/api/runs/<run id>/events`, with the page's own script and style files. Except for `/login`, these routes MUST require the dashboard cookie in place of a token. `/login` MUST accept only the one-time code described in spec run-dashboard. They MUST NOT accept the agent token or the person token from a web page. All other routes MUST keep the token rules of this spec.

#### Scenario: Token rules stay on the API

- **WHEN** a client with only the dashboard cookie calls `GET /runs`
- **THEN** the server answers with status 401

#### Scenario: The cookie on a dashboard route

- **WHEN** a client with a valid dashboard cookie calls `GET /ui/api/runs`
- **THEN** the server answers with status 200 and the list of runs

### Requirement: Every client uses the same home and project context

All default `~/.titan` paths in these specs SHALL mean `TITAN_HOME` when it is set. A run request MUST carry the client's absolute project and workflow paths. The server MUST NOT infer them from its own working folder. Commands that change shared hub, persona or policy state MUST use the single server writer. Agent tools MUST NOT write final hub files directly.

#### Scenario: Two projects use one server

- **WHEN** clients from projects A and B submit relative `plan.yaml` paths to the same server
- **THEN** each run records its own absolute project and workflow paths
- **AND** neither run reads the other project's file

### Requirement: Events are delivered from a durable cursor

Live subscriptions SHALL replay committed events after the requested id, then continue without a replay-to-live gap. An event id MUST be scoped to its run. An unknown or future cursor MUST get status 409 rather than silently omit events. The client MUST retain its last processed id and ignore a repeated id after reconnect.

#### Scenario: Event arrives during reconnect

- **WHEN** a new event commits between replay and live subscription
- **THEN** the client processes it once with no gap

#### Scenario: Future event cursor

- **WHEN** a client requests `Last-Event-ID: 999` from a run whose latest id is 10
- **THEN** the server answers with status 409

### Requirement: Run submission identifies its caller and retry

Each submission SHALL carry a stable `client_id`, a `submission_id`, an optional opaque `harness_session_id`, and its resolved harness context. The client MUST persist these ids before sending. One client MAY submit many workflows concurrently. The server MUST allocate independent run ids. Retrying the same client and submission ids with the same request hash MUST return the existing run. The request hash MUST cover workflow content, absolute project path, effective overrides and origin fields. A changed hash MUST get status 409. Intentional repeats MUST use new submission ids. The CLI MUST accept `--client-id` and `--harness-session-id`; MCP inputs MUST expose equivalent fields. Without a supplied client id, the client MUST generate one and retain it with its submission receipt. A supplied harness session id MUST be treated as opaque, without assuming an unverified vendor variable. Origin labels MUST NOT grant authority or contain credentials.

#### Scenario: One harness submits two workflows

- **WHEN** one MCP client submits workflows A and B with distinct submission ids before either finishes
- **THEN** it receives distinct run ids and can poll, watch and cancel each independently

#### Scenario: Lost submission response

- **WHEN** a run commits but its response is lost and the client retries the same ids and hash
- **THEN** the server returns the original run id and starts no duplicate work

#### Scenario: Submission id reused with changed input

- **WHEN** the same client and submission ids arrive with another workflow hash
- **THEN** the server returns status 409 without creating a run

### Requirement: Concurrent clients converge on one server

Clients racing to start the default server SHALL connect to the writer that wins the home lock. The losing bootstrap process MUST NOT cause its client to lose a submission. An explicit second `titan serve` MUST retain its exit-code-2 behavior. The home ownership lock MUST remain held for the daemon lifetime. A separate commit mutex MUST protect durable writes without serializing entire workflows. A malformed run MUST fail independently without stopping other runs.

#### Scenario: Two clients start an absent server

- **WHEN** Claude and Codex clients submit simultaneously to an empty home
- **THEN** one writer starts, both clients receive distinct run ids, and their workers overlap

#### Scenario: One invalid workflow among valid submissions

- **WHEN** one client sends an invalid workflow while another has a running workflow
- **THEN** only the invalid submission fails and the running workflow continues

### Requirement: Caller environment and recovery controls remain run scoped

The server SHALL resolve project paths, approved executables, backend settings and credential references from the submitting caller context. It MUST NOT inherit another caller's working directory or silently substitute daemon credentials. Credential values MAY enter authenticated requests as ephemeral bindings, but MUST never enter durable records, request hashes, errors or logs. Restart without required bindings MUST block as needs_credentials and request them from the authorized caller. Resume MUST offer --credentials-from-env using only allowlisted variable names. Pause, artifacts, application and configuration controls MUST follow the same typed CLI contracts and scoped authorization. Only owner-authorized configuration mutations MUST change shared settings.

#### Scenario: Daemon restart loses ephemeral credentials

- **WHEN** run A used an ephemeral credential and run B uses a different binding
- **THEN** restart blocks A until its authorized caller rebinds it and never borrows B credentials

#### Scenario: Caller working folders differ

- **WHEN** two harness clients submit relative paths from different projects
- **THEN** the server saves absolute resolved contexts and recovery returns each agent to its own folder

### Requirement: Persistent person credential startup fails closed

Under its home writer lease, the server SHALL create a random private person token only when none exists. It MUST retain a valid token across restart and shutdown and rotate the separate agent token. Existing token files MUST be regular, owned by the current user, mode 600 and single linked. Invalid bytes, symbolic links, hard links and directories MUST stop startup without replacing the original file. Token reads MUST have a byte allowance and close their descriptors before returning. Token possession MUST NOT be described as proof of human presence.

#### Scenario: Credential lifecycle preserves person identity

- **WHEN** native clients complete workflows after startup and restart
- **THEN** the person credential remains unchanged and private while the agent credential rotates
- **AND** the person token never enters the server address record

#### Scenario: Unsafe credential files refuse startup

- **WHEN** the person token is linked, shared, malformed, excessive or a directory
- **THEN** startup fails without changing the linked target or publishing an address
- **AND** removing the invalid fixture permits another server to acquire the home

#### Scenario: Browser origin cannot use either credential

- **WHEN** a call includes a web-page Origin header with either valid credential
- **THEN** the API returns 403
- **AND** missing or unrelated native credentials return 401

### Requirement: Submission fingerprints retain workflow file identity

Submission fingerprints SHALL preserve the supplied workflow_path as part of exact retry identity. An explicitly empty path and an absent path MUST remain different inputs. Restart MUST preserve this distinction and MUST NOT reinterpret stored catalog fingerprints. A rejected changed retry MUST leave the original journal, run id and quality counters unchanged.

#### Scenario: Empty workflow path keeps its retry identity

- **WHEN** an exact submission with an empty workflow_path is retried on the same or restarted owner
- **THEN** it returns its original run with an unchanged journal cursor and no new worker execution

#### Scenario: Absent path cannot replace an empty workflow path

- **WHEN** a retained submission with an empty workflow_path is retried without that field
- **THEN** HTTP returns 409 on the same or restarted owner and leaves the original run unchanged

### Requirement: Opaque caller sessions survive submission and recovery

CLI run, HTTP submission and MCP titan_run SHALL accept an optional harness_session_id with one through the central identity character allowance. Titan MUST preserve the exact supplied string in the run header and available run summaries. It MUST NOT infer a vendor environment variable or treat this label as authority. The caller label MUST remain separate from native worker and checker session identifiers.

New runs with this field MUST use run format four. Runs without it MUST retain their existing format and submission fingerprint. Request waiting and continuation MUST NOT downgrade format four. A retained submission retried with a different or newly supplied caller session MUST return HTTP 409 without changing its original run. This requirement does not supply durable client receipts, caller credentials or indexed session filtering.

#### Scenario: Caller sessions cross client surfaces

- **WHEN** CLI, HTTP and MCP submit and retry an opaque caller session within the identity allowance
- **THEN** each surface returns the original run and exposes its exact label in the header and run listing
- **AND** empty or excessive labels create no run

#### Scenario: Caller identity cannot change on retry

- **WHEN** a retained submission is retried with a changed caller session or a legacy submission acquires a caller session
- **THEN** the same or restarted owner returns HTTP 409 and preserves the original run and journal cursor

#### Scenario: Waiting preserves caller and native identities

- **WHEN** a format-four Codex worker or Claude checker waits, reloads and continues after a decision
- **THEN** its caller session remains unchanged and distinct from the retained native phase session

### Requirement: Caller labels remain consistent throughout a journal

For a journal with a caller session, initialized commits, replay and event iteration SHALL retain its first record's client_id, submission_id and harness_session_id. Changed identity or removal through a format downgrade MUST fail as corrupt_board. A legacy journal MUST NOT acquire a caller session later. Live refusal MUST leave the journal and committed snapshot unchanged and allow a subsequent valid commit. Recovery MUST validate this history before projection repair or run admission. This requirement does not change unlabelled legacy identity behavior or supply cross-process writer fencing.

#### Scenario: Valid caller and legacy histories remain readable

- **WHEN** labelled or unlabelled legacy histories retain their original identity through a live commit and replay
- **THEN** the original labels and supported format remain readable

#### Scenario: Changed caller identity is refused before append

- **WHEN** an initialized writer changes client, submission or caller session, removes its label or adds one to a legacy run
- **THEN** corrupt_board leaves its journal and snapshot unchanged and the original identity can still commit

#### Scenario: Forged caller history cannot be admitted

- **WHEN** an otherwise schema-valid later event changes client, submission or caller session, removes its label or adds one to a legacy run
- **THEN** replay, engine load and event iteration reject that record without rewriting its journal or admitting the run
- **AND** the run stays in format four without spending an extra quality attempt or operational retry

### Requirement: Caller session and project navigation use bounded pages

CLI runs, HTTP GET /runs and MCP titan_runs SHALL accept optional harness_session_id and project_path filters together with the existing client_id. Filters MUST intersect. Caller sessions MUST retain their exact opaque value within the central identity allowance. Projects MUST be absolute normalized paths within the summary character allowance. Invalid selectors MUST fail before run inspection. Selection MUST NOT grant authority or change a run.

Calls using either new filter MUST return run page version two. Calls without either MUST retain version one and its existing empty-page rules. A version-two call MUST inspect at most limit catalog rows and read at most limit plus one SQL rows. Its descending next_before MUST follow the last inspected row, even when every row was excluded. Empty pages MAY have has_more true; clients MUST follow their cursor. Once no catalog rows remain, the empty final page MUST retain its input cursor. New submissions MUST NOT enter an older range after restart. These bounded scans do not establish indexed session or project lookup, snapshot isolation across runs or dashboard support. Unfiltered inspection MUST remain available for unreadable-run diagnostics whose missing metadata cannot match the new filters.

Typed clients MUST bind the response version, cursor, count, caller, session and project to the request. They MUST reject substituted metadata, unknown versions and stalled continuation cursors. Earlier strict clients MUST refuse version two rather than apply version-one pagination rules.

#### Scenario: Session pages retain matching runs across restart

- **WHEN** HTTP, CLI or MCP selects one caller session across projects and continues through an empty bounded page while newer rows are inserted and the server restarts
- **THEN** it returns every older matching run once, excludes unlabelled and different-session rows, and preserves each run's journal cursor

#### Scenario: Project and caller filters intersect

- **WHEN** HTTP, CLI or MCP combines client, caller session and project selectors
- **THEN** only matching runs appear, crossed selectors produce no matches, and a project-only selection includes matching unlabelled legacy runs

#### Scenario: Invalid selectors and substituted pages fail

- **WHEN** a selector is empty, excessive, relative or not normalized, or a response changes its version, origin, project or cursor progress
- **THEN** validation refuses it rather than dropping a filter or admitting another run

#### Scenario: Installed filtered navigation retains both protocols

- **WHEN** the private archive is installed outside the checkout and lists a labelled run using client, session and project selectors
- **THEN** the matching selection returns version two, another session returns no match, and an ordinary caller selection still returns version one

### Requirement: Operational diagnostics use a bounded asynchronous logger

Runtime composition SHALL own an operational logger package with a typed public contract. Records MUST be versioned JSON lines on stderr. They MUST use declared levels and event names, with bounded run, node, phase and execution identities where available. Prompt text, answers, paths, credentials and arbitrary exception text MUST NOT enter these records. Known secret values MUST be refused before writing. The journal remains the durable run audit.

Home-owner server.logging settings SHALL select the minimum level, pending-record limit, record-byte limit and write deadline through the central configuration schema. Defaults SHALL be warn, 128 pending records, 4096 bytes and 1000 milliseconds. Safety ceilings SHALL be 1024 pending records, 4096 bytes and 5000 milliseconds. Project, workflow and CLI overrides MUST NOT change these owner settings. Missing settings in older stored configurations MUST retain their original shape.

Writes MUST be asynchronous, ordered and bounded. Saturation, invalid records, secret matches, partial writes and sink failures MUST return an unsuccessful diagnostic result without changing workflow state or quality accounting. A failed, incomplete or timed-out sink MUST disable further writes. This MUST keep any incomplete JSON prefix at the end of the stream and prevent abandoned operations from accumulating. Logger statistics MUST distinguish written, filtered, rejected and failed records. The authenticated health response MUST expose those bounded counters. Server startup, shutdown and background run settlement MUST use this logger without writing diagnostic lines on protocol stdout.

#### Scenario: Lifecycle diagnostics retain their identities

- **WHEN** an owner enables info diagnostics and a run settles
- **THEN** startup, run settlement and shutdown use ordered valid JSON records
- **AND** the run record retains its run identity without arbitrary task or error text

#### Scenario: Concurrent diagnostics stay bounded

- **WHEN** a blocked sink fills the configured pending allowance
- **THEN** another diagnostic is refused without another sink operation
- **AND** accepted records retain order when the sink completes

#### Scenario: Sink failure cannot exhaust the runtime

- **WHEN** a sink rejects, returns a partial write or exceeds its deadline
- **THEN** the diagnostic fails visibly in its counters without changing the run result
- **AND** the failed sink receives no further writes, including after emitting a partial JSON prefix

#### Scenario: Diagnostic settings and secrets remain protected

- **WHEN** a lower configuration layer changes logging settings or a record contains a known secret
- **THEN** the override or record is refused before it reaches the sink
- **AND** diagnostics leave protocol stdout available for its own messages
