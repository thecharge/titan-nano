## Why

Titan must remain Apache-2.0, as required by its owner. The current Linux package bundles the GPL-licensed Syd helper, which the owner has rejected.

## What Changes

- Remove the rejected helper from the delivered package and its build process.
- Preserve exact file claims on the shared live filesystem, including creation of missing files and their parents.
- Preserve protection for project metadata, environment files, daemon state and files outside a claim.
- Add a release check that inventories redistributed components and rejects the removed helper.
- Record the replacement's source, terms, build identity and containment evidence in the repository.
- Apply the owner's existing Apache-2.0 replacement requirement throughout implementation.

## Capabilities

### New Capabilities

- `script-sandbox-distribution`: Apache-2.0 distribution requirements and verified replacement of the rejected script helper.

### Modified Capabilities

## Impact

The change affects the script process boundary, package preparation, package contents, third-party notices, installation instructions and source and installed-package verification. The existing script approval and blackboard claim contracts continue to govern execution.
