# @titan/constants

## Responsibilities

Owns protocol identifiers, enums, filenames, configuration defaults and finite resource limits shared across packages. Values must have a domain name and an owning module.

## Public contract

The root export exposes domain modules. Consumers import identifiers here rather than repeating strings. This package has no product dependencies, environment reads or runtime resources. TitanRelease comes from this package manifest and supplies the CLI version, MCP identity and new run release pins. Workspace package versions must remain aligned.

## Verification

Run type checking, package boundary verification and the complete offline suite. Contract suites assert behavior driven by identifiers and limits; changing a persisted identifier also requires compatibility evidence.

## Limits

Constants are defaults and protocol values, not an alternative settings loader. User and workflow overrides belong to config. Persisted value changes can break recovery and require an explicit migration.
