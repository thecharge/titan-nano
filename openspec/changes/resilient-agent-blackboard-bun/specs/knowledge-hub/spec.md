## ADDED Requirements

### Requirement: The knowledge hub is a folder of readable files

`titan` SHALL keep each entry of the knowledge hub as one plain file in `~/.titan/knowledge/<kind>/`. The kind MUST be one of `persona`, `prompt`, `tool`, `skill`, `lesson`, `fact`, `data` and `plan`. Persona entries MUST be YAML. All other entries MUST be Markdown with a header that holds the id, kind, title, tags and version. A plan entry MUST hold the workflow as text and its run's reward.

#### Scenario: Add a fact

- **WHEN** `titan kb add fact.md` runs with a Markdown file that has kind `fact` and title "Rent in Sofia"
- **THEN** a file exists in `~/.titan/knowledge/fact/` with that header and body
- **AND** `titan` prints the new entry's id

### Requirement: The hub has a readable index

`titan` SHALL rewrite `~/.titan/knowledge/INDEX.md` after every change to the hub. It MUST have one row per entry with id, kind, title, tags, version, state (`final` or `pending`), a one-line summary and a link to the file.

#### Scenario: Index after an add

- **WHEN** `titan kb add fact.md` adds "Rent in Sofia"
- **THEN** `INDEX.md` has a row with the new id, `fact`, "Rent in Sofia", `final` and a link to the file

### Requirement: Search by words, by meaning, or both

`titan kb search "<question>"` SHALL take `--mode words`, `--mode meaning` or `--mode both`, with `both` as the default. Word search MUST use SQLite's word search (FTS5). Meaning search MUST use embeddings made on the user's computer with `Xenova/all-MiniLM-L6-v2`, stored with `sqlite-vec`. `--kind <kind>` MUST limit the results to one kind.

#### Scenario: Word search shows why it matched

- **WHEN** the hub holds a lesson "Check time zones first when tests fail at midnight"
- **AND** `titan kb search "time zones" --mode words --json` runs
- **THEN** the first result is that lesson
- **AND** the result has the text `Check [time] [zones] first`, with the matching words marked

#### Scenario: Meaning search finds a related entry without the same words

- **WHEN** the hub holds the lesson "check time zones first"
- **AND** `titan kb search "the clock is in UTC" --mode meaning --json` runs
- **THEN** that lesson is in the results, with a meaning score from 0 to 1

#### Scenario: Word search works without the vector parts

- **WHEN** `sqlite-vec` cannot load
- **AND** `titan kb search "time zones" --mode words` runs
- **THEN** the search returns results and exits with code 0
- **AND** `titan kb search "time zones"` with the default mode prints that meaning search is not ready and shows the word results

### Requirement: Every search result is readable

Each search result SHALL show the id, kind, title, file path, the matched words marked in the text, and the meaning score when meaning search ran. The output MUST NOT print embeddings.

#### Scenario: Result fields

- **WHEN** `titan kb search "time zones" --json` runs
- **THEN** each result has the fields `id`, `kind`, `title`, `path`, `matched` and `score`
- **AND** no field holds a list of 384 numbers

### Requirement: The search index can be rebuilt from the files

`titan kb reindex` SHALL rebuild `~/.titan/knowledge.db` and `INDEX.md` from the entry files alone.

#### Scenario: Index file deleted

- **WHEN** `knowledge.db` is deleted and `titan kb reindex` runs
- **THEN** `titan kb search "time zones" --mode words` returns the same results as before the delete

### Requirement: Entries can be read, changed and deleted, and old versions stay

`titan kb get`, `titan kb update` and `titan kb delete` SHALL read, change and delete entries by id. An update or delete MUST keep the old text in `~/.titan/knowledge/.history/`.

#### Scenario: Update keeps the old version

- **WHEN** `titan kb update <id> new.md` changes the body of "Rent in Sofia"
- **THEN** `titan kb get <id>` prints the new body with version 2
- **AND** `.history/` holds version 1 with the old body

### Requirement: The swarm can use the hub during a run

`titan` SHALL let every agent use the hub through its tools, as in spec tool-servers, without pausing for ordinary fact changes. Each pending change MUST name its run, step, candidate and attempt. It MUST stay in that attempt's private files until the step keeps that candidate. Other agents and public searches MUST see only final entries. The owning attempt MUST read its own pending changes through its scoped tools. Pending files MUST stay outside the public index. A refuted attempt or a candidate that the judge did not keep MUST lose its pending changes. Only the kept candidate's changes MUST become final. Persona deletion MUST use `delete_persona` approval, even through `kb_delete` or the CLI.

#### Scenario: Refuted attempt cannot publish on a later success

- **WHEN** attempt 1 adds fact A and is refuted, and attempt 2 adds fact B and is kept
- **THEN** only fact B becomes final
- **AND** no other run or falsifier could read fact A

#### Scenario: Losing candidate cannot publish

- **WHEN** candidates A and B both survive, both change the hub, and the judge keeps B
- **THEN** only B's changes become final

#### Scenario: Hub delete cannot bypass persona approval

- **WHEN** an agent calls `kb_delete` on a persona
- **THEN** the server creates a `delete_persona` request at level `human`
- **AND** the persona stays until the person approves

#### Scenario: Refuted step's fact is undone

- **WHEN** an agent in a step calls `kb_add` with a fact and the step's result is refuted on every attempt
- **THEN** the fact is not in the hub after the run
- **AND** the board logs the add and the undo

#### Scenario: Surviving step's fact is kept

- **WHEN** an agent in a step calls `kb_add` with a fact and the step's result survives
- **THEN** the fact is in the hub with state `final`

### Requirement: Changes from many processes at once are not lost

`titan` SHALL change an entry only when the entry still has the version that was read. Every connection to `knowledge.db` MUST set `busy_timeout` to 5000 ms before any other statement. The server MUST be the only writer of final entry files. It MUST keep a durable change record before replacing a file, then replace the file by an atomic rename. After a crash, it MUST finish or undo that change before serving readers. The index MUST be rebuilt from committed files. A pending update whose base version changed MUST fail with a conflict. It MUST NOT overwrite a newer final entry.

#### Scenario: Crash between file and index changes

- **WHEN** the server stops after replacing an entry file and before updating its search index
- **THEN** restart repairs the index before serving readers
- **AND** the entry file, history and search result show the same committed version

#### Scenario: Pending change conflicts with a newer entry

- **WHEN** an attempt changes version 1, another run commits version 2, and the first attempt's result is kept
- **THEN** its pending change is refused with a version conflict
- **AND** version 2 stays unchanged

#### Scenario: Eight writers at once

- **WHEN** 8 processes each run `titan kb update` 300 times on the same entry at the same time
- **THEN** each write either commits once or returns a version conflict with exit code 2
- **AND** if C writes committed, the final version is 1 + C and history holds every earlier committed version
- **AND** no stale write silently overwrites another change

### Requirement: Plan entries can be rebuilt and searched

`titan` SHALL include plan entries in `INDEX.md`, word search and reindexing, like the other entry kinds.

#### Scenario: Plan survives reindexing

- **WHEN** a run saves a plan with reward 0.7 and `titan kb reindex` runs
- **THEN** `titan kb search --kind plan --mode words` can find that plan
- **AND** the entry still holds its workflow text and reward 0.7

### Requirement: Publication conflicts are visible in the run outcome

A kept candidate's pending hub changes SHALL commit as one set or remain unpublished. A base-version conflict MUST leave the whole set unpublished and record a publication conflict. The run MUST end `failed` with that evidence, even if the step's checks survived. It MUST NOT retry a stale edit automatically.

#### Scenario: One of two pending entries conflicts

- **WHEN** a kept candidate changes entries A and B, but B's base version changed in another run
- **THEN** neither pending change commits and the run reports a publication conflict

#### Scenario: Attempt reads its own update

- **WHEN** an attempt updates fact A then calls `kb_get` for A
- **THEN** that attempt sees its pending version while another candidate sees only the final version

### Requirement: Concurrent runs share only committed knowledge

Each hub search SHALL read a consistent committed snapshot and report its revision. A run MAY see another run's newly committed lessons on its next search. It MUST NOT see that run's pending attempts. Shared publication conflicts MUST preserve both runs' evidence and require a new checked update against the current version. A run MUST pin persona versions and policy choices already resolved for active work; later shared updates MUST NOT rewrite them.

#### Scenario: Another run publishes during a search

- **WHEN** A searches while B commits a lesson set
- **THEN** A receives one consistent revision with none or all of that set; its next search can see the committed set

#### Scenario: Persona updated while another run uses it

- **WHEN** A resolved `fixer@2` and B publishes `fixer@3`
- **THEN** A's active execution keeps `fixer@2` and its evidence; later choices may explicitly resolve version 3

### Requirement: Private edits use an observed attempt revision

Every scoped private write SHALL include the private revision last read by that attempt, or null when no private set exists. Two concurrent writes against the same private revision MUST NOT both succeed. Different attempts MAY stage changes concurrently. Repeated private edits to one final entry SHALL retain its original final base version and produce one final version when published. Deleting an unpublished addition SHALL cancel that addition. Only the owner may publish or discard a set; the agent's private entry view MUST NOT grant those operations.

#### Scenario: Two writes share one private revision

- **WHEN** two calls change the same attempt using the same observed private revision
- **THEN** only one succeeds and the other reports a conflict without losing the accepted change

#### Scenario: An attempt edits its pending entry twice

- **WHEN** an attempt makes two accepted private edits to a final entry
- **THEN** publication checks the original final base version and advances that final version once

#### Scenario: An attempt cancels its new entry

- **WHEN** an attempt deletes an entry it added privately
- **THEN** that addition is removed from its proposal and never appears in final reads or public searches

### Requirement: Private search has one consistent scoped view

An attempt's search SHALL combine one private revision with one committed revision. Its pending additions and updates MUST replace matching final entries, and pending deletions MUST exclude final entries before the result limit. Matching private entries SHALL precede committed matches. The result MUST identify each entry as pending or final and provide a readable path. Private text MUST NOT enter the public search database or index. The result byte limit MUST include the added scope metadata. Published and discarded proposals MUST NOT contribute private matches. Native tool access MUST still require active server-held authority.

#### Scenario: A private search replaces final matches

- **WHEN** an attempt searches after privately updating A, deleting B and adding C
- **THEN** its results include matching pending A and C, exclude B and include unchanged committed matches within the requested limit
- **AND** another scope and public search see only committed entries

#### Scenario: Publication fails while a private search waits

- **WHEN** an attempt's search waits behind a final publication that fails
- **THEN** the search fails without presenting a partial revision as a valid result
- **AND** queued private writes are refused until the owner recovers

#### Scenario: Private result metadata reaches the byte limit

- **WHEN** base search results fit the page budget but their scoped visibility and paths would exceed it
- **THEN** the scoped page stops before the limit and reports truncation

### Requirement: The hub has a project scope and a home scope

`titan` SHALL keep two hubs. The project hub is in `<project>/.titan/knowledge/`. The home hub is in `~/.titan/knowledge/`. Both hubs MUST use the same entry files, the same `INDEX.md` and the same search index. Every command that reads the hub MUST read both hubs and show the scope of each entry. A new entry from a run MUST go to the project hub unless the person chooses the home hub. `titan kb promote <id>` MUST copy a project entry to the home hub and keep the project entry. The project hub MUST be a plain folder that Git can track. A person who clones the project MUST get its project hub.

#### Scenario: A run saves a lesson in the project

- **WHEN** a run saves a lesson and the project is `/work/app`
- **THEN** a file exists in `/work/app/.titan/knowledge/lesson/`
- **AND** `~/.titan/knowledge/lesson/` has no new file

#### Scenario: Search reads both hubs

- **WHEN** the project hub has a fact about "UTC" and the home hub has a fact about "time zones"
- **AND** `titan kb search "time" --json` runs
- **THEN** the answer lists both facts and names the scope of each

#### Scenario: Promote an entry

- **WHEN** `titan kb promote <id>` runs for a project entry
- **THEN** the home hub has the same entry and the project entry is still there

#### Scenario: Clone brings the project hub

- **WHEN** the project is cloned to a new folder and `titan kb search "UTC" --mode words` runs there
- **THEN** the project fact is found

### Requirement: The swarm always uses the hub

Every run MUST read the hub before its first step and MUST write its results back. Before the first step, the run MUST search both hubs for lessons and plans that match the goal and MUST give the best matches to the main agent. Every persona that starts a step MUST have the `kb_search` and `kb_add` tools. When a step passes, the run MUST save its lesson. When a step is refuted, the run MUST save the reason as a lesson. A run MUST NOT start without the hub tools. The run record MUST list the entries that were read and the entries that were written.

#### Scenario: Run reads and writes the hub

- **WHEN** a run with one passing step and one refuted step ends
- **THEN** the run record lists the entries read before the first step
- **AND** it lists one lesson for the pass and one for the refutation
- **AND** both lessons are in the project hub

#### Scenario: Persona has hub tools

- **WHEN** a worker persona starts a step
- **THEN** its tool list holds `kb_search` and `kb_add`

#### Scenario: Hub tools are missing

- **WHEN** a run starts and the hub tools cannot be offered
- **THEN** the run does not start and says why

### Requirement: A person can explore the hub

`titan kb list` SHALL list entries from both hubs with `--kind`, `--scope`, `--tag` and `--state`. `titan kb stats` SHALL print the figures for each scope and kind. The figures are the number of entries, the total size, the oldest and newest entry and the number of entries never read. It MUST also say whether meaning search is ready. `titan kb show <id>` SHALL print an entry with its history and its links. The dashboard MUST show the same list and counts, read-only.

#### Scenario: List by scope

- **WHEN** `titan kb list --scope project --kind lesson --json` runs
- **THEN** it lists only lessons from the project hub

#### Scenario: Stats

- **WHEN** `titan kb stats --json` runs on a hub with 3 lessons and 1 fact
- **THEN** the counts are 3 and 1, and the answer names the scope

### Requirement: A person can prune and consolidate the hub

`titan kb prune` SHALL find entries that are old and never read, entries that a newer version replaced, and entries that repeat another entry. It MUST only report them unless `--apply` is given. With `--apply` it MUST move each entry to `.history/` and MUST NOT delete any text. `titan kb consolidate` SHALL join entries that repeat each other into one entry that names every source id and keeps their tags. It MUST only report the plan unless `--apply` is given. After either command with `--apply`, `titan kb reindex` MUST give the same search results as before for the kept entries. A person MUST be able to undo with `titan kb restore <id>`.

#### Scenario: Prune report changes nothing

- **WHEN** `titan kb prune --json` runs on a hub with one duplicate
- **THEN** it reports the duplicate
- **AND** the hub files are unchanged

#### Scenario: Prune with apply keeps the text

- **WHEN** `titan kb prune --apply` runs
- **THEN** the duplicate is in `.history/` with its full text
- **AND** `titan kb restore <id>` brings it back

#### Scenario: Consolidate

- **WHEN** `titan kb consolidate --apply` runs on two entries that repeat each other
- **THEN** one entry exists that names both source ids
- **AND** both sources are in `.history/`

### Requirement: The meaning search model is downloaded during install

`titan install` SHALL download the local meaning-search model once, after it tells the person the model name and its size. `--no-model` MUST skip the download. `titan doctor` MUST report the model as ready or missing and MUST show the command that fetches it. `titan doctor --fetch-model` MUST download a missing model. Offline doctor without that option MUST make no download. When the model is ready, `titan kb search` MUST use meaning search by default. After the first download, search MUST work without a network.

#### Scenario: Install downloads the model

- **WHEN** `titan install` runs and the model is missing
- **THEN** it prints the name and size, downloads the model and doctor reports it ready

#### Scenario: Install without the model

- **WHEN** `titan install --no-model` runs
- **THEN** nothing is downloaded and doctor reports the model missing with the fetch command

#### Scenario: Search offline after the download

- **WHEN** the model is ready and the network is off and `titan kb search "the clock is in UTC" --mode meaning` runs
- **THEN** it finds the related entry

### Requirement: Every run keeps a journal and every workflow shares what it learns

When a run ends in any state, `titan` SHALL save one journal entry in the project hub. The journal MUST name the run, each step, who worked on it, the files it changed, the check results, each refusal with its reason, and each lesson saved. A journal entry MUST be a `lesson` entry with the tag `journal`. A run MUST NOT end without its journal. If the project hub cannot be written, the run MUST end as blocked and name the folder. Before a workflow plans or builds, it MUST search both hubs, and the run record MUST list the entries it found. A later run MUST see the journals of earlier runs on its next search.

#### Scenario: A finished run leaves a journal

- **WHEN** a run with two steps ends, one passed and one refuted
- **THEN** one file with the tag `journal` exists in `<project>/.titan/knowledge/lesson/`
- **AND** it names both steps, the refusal reason and the changed files

#### Scenario: A failed run leaves a journal

- **WHEN** a run ends as failed
- **THEN** its journal exists and names the failing step

#### Scenario: A run that cannot write its journal is blocked

- **WHEN** the project hub folder cannot be written
- **THEN** the run ends as blocked and the answer names the folder

#### Scenario: The next workflow reads the earlier journal

- **WHEN** a second run starts after a run that left a journal
- **THEN** the second run record lists that journal among the entries it found before its first step
