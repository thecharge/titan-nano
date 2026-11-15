# @titan/artifacts

## Responsibilities

Owns read-only inspection of kept workflow deliveries. It verifies bytes and executable intent against the manifest and the passed journal event before returning review metadata.

## Public contract

`inspectArtifacts` accepts a committed run. A delivery must have passed and use its expected kept directory. The result includes stable file identifiers, relative paths, content hashes, sizes, executable intent, outputs and producing workflow identity. Missing or altered evidence fails closed. New manifests and their passed journal commitments carry the report-format version. Their reports are streamed and compared against committed step outcomes, attempts, refutations, evidence and final outputs under the central 16 MiB budget. A mismatched format marker fails inspection. Legacy deliveries without either marker retain their original report rendering and 1 MiB budget.

`readArtifact` verifies the kept delivery, selects a stable file identifier and returns a versioned byte page. The page uses base64 and reports its producing identities, file metadata, byte offset, next offset and whether more bytes remain. Offset and length use central strict schemas with a 64 KiB page cap. Unknown files, oversized requests and offsets beyond the end fail. The final empty page is valid at the exact file size.

`readArtifactBytes` is the lower-level verified range reader for an already selected file entry. It opens without following a final symlink, checks executable intent and streams the entire expected file while retaining only the selected page. It refuses changed size, content hash and mode before returning bytes. It does not establish a run commitment by itself; callers needing delivery evidence use `readArtifact`. `parseArtifactSearch` validates text query parameters before I/O. Each page rechecks evidence and reads the selected file; large multi-page reviews repeat this I/O rather than trusting an earlier mutable-file check.

## Verification

Use the offline shared artifact cases and CLI, HTTP and MCP parity cases. They retain the original project and falsify kept bytes, executable flags, manifest entries, result content, journal commitments and symbolic links. Byte-range cases cover binary data, stream boundaries, empty files, cursor admission, size/hash/mode changes and typed client binding. Nested CLI, HTTP and MCP cases retain the same results and errors.

## Limits

Inspection does not export or apply files. It does not claim that an external operation happened. Filesystem ownership and process confinement are separate boundaries; repeated validation is not an operating-system sandbox.

`exportArtifact(run, fileId, destination)` verifies a passed delivery and streams one selected file into a new private review directory. `files/` retains the original relative path; `artifact.json` carries the selected file identity, content hash, byte size, executable intent, workflow revision, delivery hash and outputs. The parent must exist without links. An existing destination or a destination within the run storage is refused. The default writer uses the same verified bounded stream copying as candidate snapshots. Its optional typed writer port supports explicit filesystem fault injection; trusted callers own injected implementations. Unknown write failures become typed export errors after cleanup of the directory this call created. A process or machine crash can leave an incomplete directory. This is a local copy for review, not approved application or an OS boundary against concurrent hostile filesystem changes.

Inspection finds the original passed delivery commitment through the selected committed cursor. Later request opening and answer events may retain that delivery only when their run state is identical apart from journal version. Other later events, a second passed event, a missing tail or changed current/intermediate state fail. State comparison uses bounded strict JSON bytes, while retained files still require their original content and executable hashes. Recording approval cannot hide altered delivery evidence.
