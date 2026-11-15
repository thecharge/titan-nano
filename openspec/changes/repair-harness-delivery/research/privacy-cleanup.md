# Privacy cleanup

## Authorized scope

The owner authorized review, sanitation, history rewriting and pushing the cleaned repository before publication. The repository remains private. Recovery copies of the original repository and local runtime data are kept outside the repository with owner-only directory access.

## Publication changes

Accumulated run state, installation-specific configuration, the generated MCP registration, attribution bookkeeping and historical Bun cache files are removed from the reachable publication history. The self-development example remains under [docs/examples/self-development](../../../../docs/examples/self-development/README.md). It is labeled as a sanitized inspection export. Native session identifiers use deterministic UUID aliases, personal filesystem paths use generic replacements and usage totals are omitted. The original private records retain exact execution evidence and recovery data.

The public branch begins with the sanitized current tree as a clean publication baseline. The complete original development history remains in the private recovery copy. Public Git author and committer identities use the GitHub handle and GitHub no-reply email address. Revision references in current Markdown were updated during sanitation. Source identities retained in older evidence describe private historical revisions.

Root ignore rules exclude new local runtime state, generated registrations, local workflow delivery files and Claude worktrees. Canonical plugin instructions and plugin metadata remain tracked. The runnable self-development workflow uses the current project and asks for a user-supplied controller home.

## Image review

Seventeen reachable historical PNG objects were visually reviewed. They show fixture dashboards, synthetic runs, temporary test paths and dashboard research tools. Their displayed session identifiers belong to fixture runs. The remaining three non-image binary objects were historical Bun cache files and were removed.

## Verification and GitHub retention

Complete normal hooks, installed-package acceptance, source privacy checks and secret-pattern scanning passed on the publication baseline. The sanitized export file digests also match. Results are retained in the [delivery evidence](../evidence.md#2026-11-15-privacy-cleanup-verification-and-remote-retention).

GitHub can retain old commit objects and cached views after force-pushing. A rewrite changes reachable branch history. GitHub Support controls server-side removal of retained objects. After the authorized force-push, the old commit and document endpoints still returned the earlier document with its original personal path. The owner subsequently authorized a fresh private publication repository and preservation of the existing remote under a private-history name. The repository split and final inspection are recorded below. See [GitHub's removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Fresh publication repository

The original repository was renamed to thecharge/titan-nano-private-history-20261115 and remains private under repository identifier 1446629079. Its retained objects stay within that private repository. The replacement thecharge/titan-nano is a separately created private repository under identifier 1459003959. GitHub reports fork false. The replacement was created without importing the original repository or initializing another branch.

Clean main was pushed at b1c56a29b2ddda61ab17f7c8eb95c23a471ef9e5 through the ordinary outgoing hook. A fresh single-branch clone contains two publication commits. The original pre-cleanup commit is absent from that clone. Its commit API request against the replacement returns 422 with no commit found, and the old document request returns 404. The retained-object publication blocker is resolved for the replacement repository.

Both repositories have Actions disabled. The replacement has Issues enabled, pull requests disabled and Apache-2.0 recognized by GitHub. Visibility remains private for the owner to change after inspection. Original local runtime data, private branches and the unrelated untracked test remain preserved. The original working copy tracks the canonical replacement URL.
