## ADDED Requirements

### Requirement: Each persona version has measures

`titan` SHALL keep these measures for each persona version, updated after each run:

- uses: how many results it gave;
- survived and refuted: how many of its results survived or were refuted;
- asked: how often other agents asked it for help;
- the usage numbers that the backend reports;
- for a falsifier: how many results it refuted, and how many results it passed that a later check refuted.

`titan persona show <name>` MUST print these measures for each version.

#### Scenario: Measures after a run

- **WHEN** `investigator@2` gave 3 results in a run and 2 survived
- **THEN** `titan persona show investigator --json` shows for version 2 `uses` 3 higher, `survived` 2 higher and `refuted` 1 higher than before the run

### Requirement: A persona moves through six states

Each persona version SHALL be in one of these states: `proposed`, `trial`, `proven`, `needs_update`, `retired` or `deleted`. `titan` MUST move a version by these rules, with a bar of 0.6 for the survival rate. The bar is a guess that has not been measured. The _Wilson bound_ is the lowest or highest survival rate that still fits the results so far, with 95 % confidence.

- `proposed` to `trial`: the request for the persona is approved.
- `trial` to `proven`: the Wilson lower bound of its survival rate is above the bar.
- `trial` or `proven` to `needs_update`: the Wilson upper bound is below the bar.
- to `retired`: a `retire_persona` request is approved. A newer proven version with a higher survival rate MUST trigger that request. Two consecutive versions in `needs_update` MUST trigger a review request, not retire the only remaining eligible version automatically.
- to `deleted`: a `delete_persona` request is approved by the person.

Every move MUST be written to the persona's history with the numbers that caused it.

#### Scenario: A good persona becomes proven

- **WHEN** a persona version in `trial` has 17 survived results out of 20
- **THEN** its state is `proven`, because the Wilson lower bound is 0.640

#### Scenario: Not enough results yet

- **WHEN** a persona version in `trial` has 16 survived results out of 20
- **THEN** its state stays `trial`, because the Wilson lower bound is 0.584 and the upper bound is 0.919

#### Scenario: A weak persona needs an update

- **WHEN** a persona version has 1 survived result out of 8
- **THEN** its state is `needs_update`, because the Wilson upper bound is 0.471
- **AND** `titan` sends an `improve_persona` request to the main agent with the refutations of that version

### Requirement: Wilson calculations have fixed numerical tests

`titan` SHALL compute Wilson bounds with `z = 1.96`, using the number of survived results and total results. With no results, the bounds MUST be 0 and 1. Tests MUST compare numerical examples within 0.001. A property test MUST check that both bounds stay between 0 and 1, with the lower bound never above the upper bound.

#### Scenario: Wilson bound examples

- **WHEN** the calculator receives 17 successes in 20 results, then 1 success in 8 results
- **THEN** their lower and upper bounds are about 0.640 and 0.948, then 0.022 and 0.471

#### Scenario: Wilson bound property

- **WHEN** a property test with seed 42 supplies valid success and total counts, including zero totals
- **THEN** every result has `0 <= lower <= upper <= 1`
- **AND** zero totals return lower 0 and upper 1

### Requirement: An update runs next to the old version

When the main agent answers an `improve_persona` request, `titan` SHALL save the new version in state `trial`. The old version MUST stay in use until it is `retired`. Both versions MUST be picked by the rule in this spec.

#### Scenario: Old and new versions both picked

- **WHEN** `skeptic@3` is in `needs_update` and `skeptic@4` is saved in `trial`
- **THEN** the board line for the next pick for an open call that matches `skeptic` lists both `skeptic@3` and `skeptic@4` as candidates

### Requirement: Retired and deleted personas are not picked

`titan` MUST NOT pick a persona version in state `retired` or `deleted` for an open call. `titan kb search --kind persona` MUST leave them out, unless `--all` is given. Runs that used them MUST still be readable.

#### Scenario: Search leaves out a retired persona

- **WHEN** `skeptic@3` is `retired` and `skeptic@4` is `proven`
- **THEN** `titan kb search --kind persona "skeptic" --json` lists `skeptic@4` and not `skeptic@3`
- **AND** with `--all` it lists both, each with its state

### Requirement: A delete needs the person and keeps the file

A `delete_persona` request SHALL wait at level `human`. When the person approves it, `titan` MUST move the persona's file to `~/.titan/knowledge/.history/`. `titan` MUST NOT remove the file.

#### Scenario: Person approves a delete

- **WHEN** the person runs `titan approve <run id> r5` for a `delete_persona` request for `old-coder`
- **THEN** `~/.titan/knowledge/persona/old-coder.yaml` is gone
- **AND** its content is in `~/.titan/knowledge/.history/`

### Requirement: Near duplicates are offered as a merge

After each run, `titan` SHALL compare the role texts of personas in state `trial` or `proven` by meaning. When two have a meaning score of 0.9 or more, `titan` MUST send one `merge_personas` request to the main agent with both names. The 0.9 is a guess that has not been measured.

#### Scenario: Two skeptics

- **WHEN** `skeptic@4` and `doubter@1` have role texts with a meaning score of 0.93
- **THEN** there is one open `merge_personas` request that names both

### Requirement: Persona pick follows its results and adapts to change

For an open call, `titan` SHALL consider matching versions in state `trial`, `proven` or `needs_update`. It MUST exclude the worker's version from a falsifier pick. With N eligible versions, each version MUST have probability `min(0.1, 1/N)` before the remaining probability follows Thompson sampling. _Thompson sampling_ MUST draw from `Beta(1 + survived, 1 + refuted)` for each version and pick the highest draw. Ties MUST use version-id order. Selection MUST first choose the floor branch with probability `N * min(0.1, 1/N)` and pick uniformly there. The remaining branch MUST use these beta draws. Wilson measures MUST use unfaded counts; only sampling counts MUST fade. The counts MUST fade: before each new result is added, `titan` multiplies the sampling counts of versions sharing that exact sorted tag set by 0.98. The board MUST record the eligible set, random seed and chosen version. The 0.98 and the probability floor are guesses that have not been measured. The floor is a probability, not a promise about each finite sample.

#### Scenario: More than ten matching versions

- **WHEN** an open call has 20 eligible versions
- **THEN** each has probability 0.05 and the probabilities sum to 1

#### Scenario: Persona that got better is found

- **WHEN** a test with a fixed seed makes persona A survive 75 % and persona B 55 % for 200 picks
- **AND** then swaps the two rates for 200 picks, and repeats this 2000 times
- **THEN** on average, B gets more than half of the picks after the swap

#### Scenario: Floor for a slightly worse persona

- **WHEN** a test with a fixed seed makes two matching personas survive 62 % and 60 % for 400 picks, and repeats this 2000 times
- **THEN** fewer than 1 % of the repeats give one persona under 10 % of the picks

### Requirement: Persona measures count proof answers

For a persona version whose results had completed semantic proof checks, `titan` SHALL also keep the counts `proven`, `refuted_by_check` and `not_proven`. The survival rate in the Wilson rules MUST count a result with checks as survived only when every check gave `proven` and every remaining falsifier said `survived`. Goal checks MUST affect the run, not be assigned to an arbitrary persona. `titan persona show <name>` MUST print these counts for each version.

#### Scenario: Proof counts after a run

- **WHEN** `lean-prover@1` gave 3 results with Lean checks, and 2 of them gave `proven` and 1 completed normally with a semantic rejection labeled `not proven`
- **THEN** `titan persona show lean-prover --json` shows for version 1 `proven` 2 higher, `not_proven` 1 higher and `survived` 2 higher than before the run

### Requirement: Operational outcomes do not train quality measures

Persona history SHALL separate completed quality outcomes from interruption and recovery counts. Actual cost and time MUST remain visible for every execution segment. Uses for Wilson scores, sampling counts and retirement MUST count only completed result verdicts. Transport failures, rate limits and unresolved checks MUST NOT become negative persona examples. Rollups MUST deduplicate logical results across segments and restarts.

#### Scenario: Outage does not retire a persona

- **WHEN** a proven persona has five interrupted sessions and no completed result verdict
- **THEN** its quality counts, Wilson score and lifecycle state remain unchanged while all interruptions and usage remain visible
