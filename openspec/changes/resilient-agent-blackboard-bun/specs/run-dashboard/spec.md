## ADDED Requirements

### Requirement: titan serve shows a dashboard of runs

`titan serve` SHALL serve a _dashboard_: a web page that shows past and running runs and their numbers. The page MUST be served on the same 127.0.0.1 port as the HTTP API, under `/`. `titan` MUST build the page from its own files, with a Bun HTML import. The page MUST NOT load any file from another host. Every page answer MUST carry the header `Content-Security-Policy: default-src 'self'`.

#### Scenario: The page loads only from titan

- **WHEN** a person opens the dashboard after login
- **THEN** every script and style of the page comes from the `titan` server's own address
- **AND** the answer has the header `Content-Security-Policy: default-src 'self'`

### Requirement: A person logs in to the dashboard with a one-time code

`titan dashboard` SHALL print a login link of the form `http://127.0.0.1:<port>/login?code=<code>`. The code MUST be random and work only once. It MUST stop working after 60 s. The 60 s is a guess that has not been measured. When the code is right, the server MUST answer with status 303 and set a session cookie with the flags `HttpOnly`, `SameSite=Strict` and `Path=/`. A wrong, old or used code MUST get status 403. Except for `/login`, a dashboard route called without the cookie MUST get status 401. Login MUST consume its code atomically and redirect to `/` without the code. The response MUST set `Referrer-Policy: no-referrer` and `Cache-Control: no-store`. A dashboard call whose `Origin` header names another site MUST get status 403. The code and the cookie MUST NOT be written to the run record or to any log. The cookie MUST expire when the server restarts. `titan dashboard` MUST start the server when needed. With `--json`, it MUST return one object containing the link instead of a text line.

#### Scenario: Login and a second try with the same code

- **WHEN** a person opens the printed link, and then a second browser opens the same link
- **THEN** the first answer has status 303 and sets a cookie with `HttpOnly; SameSite=Strict; Path=/`
- **AND** the second answer has status 403

#### Scenario: No cookie

- **WHEN** a client calls the dashboard's run list without the cookie
- **THEN** the server answers with status 401

#### Scenario: Call from another site

- **WHEN** a call with a valid cookie has the header `Origin: https://example.com`
- **THEN** the server answers with status 403

### Requirement: The dashboard lists past and running runs

The dashboard SHALL list every run in the run records of `titan`, both finished and running. For each run, it MUST show:

- the run id, the workflow name, the state, the start time and the time it took;
- the number of attempts and the most agents that ran at once;
- the input tokens, the output tokens and the cost in US dollars, as the backends reported them;
- the number of results that survived and were refuted;
- the number of checks that were proven, refuted and not proven, as in spec verified-checks.

The numbers MUST be computed from `events.jsonl` of each run. They MUST be equal to the numbers in `GET /runs/<run id>` of the HTTP API. A number that no backend reported MUST be shown as "not reported", not as 0.

#### Scenario: A past run and a running run

- **WHEN** the run folder holds a finished run and a second run that is still running
- **AND** the finished run has tokens 2100 in and 1000 out, cost 0.03, 1 survived result and 1 proven check
- **THEN** the dashboard lists the first run as `passed` with these numbers
- **AND** it lists the second run as `running`

#### Scenario: Cost not reported

- **WHEN** a run used a backend that reports no cost
- **THEN** the dashboard shows the cost of that run as "not reported"

### Requirement: The dashboard shows the steps of a run

The page of one run SHALL show its steps in the order and the groups of the workflow, with steps that agents added during the run. For each step, it MUST show the persona, the state, each attempt with its verdicts and evidence, and the answer of each proof check. It MUST also show the board messages of the run and its open requests.

#### Scenario: A refuted attempt and a proof

- **WHEN** step `prove` had attempt 1 refuted with the evidence "Illegal axiom detected: 'sorryAx'" and attempt 2 proven
- **THEN** the run page shows both attempts of `prove`, the evidence of attempt 1, and the answer `proven` for attempt 2

### Requirement: The dashboard updates while a run goes on

The page SHALL get new events of a running run over server-sent events, without a reload. When the page connects again, it MUST send `Last-Event-ID`, and the server MUST replay committed events in order and the page MUST deduplicate ids, as in spec titan-server. A new event MUST appear on the page within 2 s. The 2 s is a bar chosen for this design. In the probe, an event arrived in 201 ms.

#### Scenario: A new event during a run

- **WHEN** the run page is open and `titan` writes a new event to the run
- **THEN** the page shows the event within 2 s, without a reload

#### Scenario: Connect again after a break

- **WHEN** the page connects again with `Last-Event-ID: 3`
- **THEN** the first event it gets has id 4

### Requirement: The dashboard only reads

The dashboard MUST NOT change product state: runs, requests, personas or hub files. Login MAY consume its code and create a dashboard session. Its routes MUST answer only `GET`. Any other method on a dashboard route MUST get status 405. The cookie MUST NOT work on the HTTP API routes that start, change or answer things. The page MUST show how to answer an open request with `titan answer`, and MUST NOT answer it itself.

#### Scenario: A change through the dashboard

- **WHEN** a client with a valid cookie calls `POST` on a dashboard route
- **THEN** the server answers with status 405 and no file in the run folder changes

#### Scenario: The cookie on an API route that answers a request

- **WHEN** a client sends `POST /requests/<request id>/answer` with only the dashboard cookie
- **THEN** the server answers with status 401

### Requirement: The guide shows how to view spans in a trace viewer

`titan guide` SHALL show one example of how to view the spans of runs in Jaeger, a trace viewer, on the person's computer. The example MUST use the image `jaegertracing/jaeger:2.22.0`, bind its ports to 127.0.0.1, and set `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://127.0.0.1:4318`, as in spec workflow-run. The guide MUST say that Jaeger in this setup keeps spans in memory only.

#### Scenario: Jaeger example in the guide

- **WHEN** a person runs `titan guide`
- **THEN** the output holds `jaegertracing/jaeger:2.22.0`, `127.0.0.1` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318`

### Requirement: Untrusted record text is shown as text

The page SHALL render task text, evidence and board messages as text. It MUST NOT execute HTML or scripts from a run record. Usage totals MUST be complete only when every contributing backend reported that measure. A partial total MUST show its reported subtotal and the missing contributions.

#### Scenario: Evidence contains browser code

- **WHEN** evidence contains `<img src=x onerror=alert(1)>`
- **THEN** the page shows that text and executes no handler

#### Scenario: One backend omits cost

- **WHEN** one agent reports cost 0.03 and another reports no cost
- **THEN** the page and HTTP API label 0.03 as a partial subtotal with one missing contribution

### Requirement: The overview makes concurrent work visible

The dashboard SHALL show a global run overview with project, workflow, harness, client, optional harness session, state and open-request counts. It MUST distinguish active work, waiting for input and queued for capacity. It MUST show active agent slots against the server limit and each run's limit. Filters MUST match the run API, with direct links preserving the full run id. The overview MUST refresh its snapshot within 2 s of a committed change; this is a design target to measure. Run-detail event cursors MUST remain independent.

#### Scenario: See two harnesses and several workflows

- **WHEN** Claude has two runs and Codex has one, with one active, one queued and one waiting
- **THEN** the overview shows all three with their origins and reasons; filtering Claude leaves its two runs

#### Scenario: Overview changes without opening a run

- **WHEN** a new run starts while the overview is open
- **THEN** its row and global capacity numbers appear within 2 s without a reload

#### Scenario: Switch between live run pages

- **WHEN** a person watches A, opens B and returns to A
- **THEN** each page resumes its own event cursor and shows only that run's events

### Requirement: Recovery and dependency progress are visible

The dashboard SHALL render dependency edges and mixed groups from the resolved plan. It MUST distinguish content rejection, skipped dependencies, waiting, recovery, blocking and pause. Each attempt MUST show its execution segments, checkpoint, restoration mode, interruption cause and next recovery action. Quality totals MUST exclude operational interruptions while cost totals retain their usage. Views MUST expose effective configuration hashes, artifact manifests and run origin without exposing credentials.

#### Scenario: Rate limit in the dashboard

- **WHEN** one branch waits for vendor capacity while another completed successfully
- **THEN** the graph shows both states, no invented refutation and the blocked branch recovery date
