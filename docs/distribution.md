# Distribution acceptance

The distribution gate tests the preview archive and a private package registry. It requires the locally prepared Titan offline test image, a Titan CLI archive, and a directory of trusted runtime dependency tarballs for the target platform. Include the pinned versions from the CLI manifest, their transitive dependencies, and the native tarballs used on that platform. The gate consumes those artifacts without downloading an image or obtaining tarballs from a public registry.

```sh
bun run pack:preview /tmp/titan-release
bun tooling/scripts/check-package-registry.ts /tmp/titan-release/titan-cli-0.1.0-alpha.1.tgz /tmp/titan-dependencies
bun run test testing/integration/distribution.test.ts
```

The gate copies the CLI and dependency archives and a bundled probe to a temporary directory. Podman mounts only that directory, read-only, and runs with external networking disabled. The probe serves package metadata and tarballs on loopback. Each install uses a fresh project, home, and Bun cache with lifecycle scripts disabled. It first withholds the required `sqlite-vec` package and requires the install to fail after the registry receives that request. It then restores the package and runs the shipped fake-backed example through the installed `titan` executable. A separate clean install takes the local archive as its package specifier, resolves its dependencies from the same private registry, and runs the example again. The probe prints both run identifiers and the staged archives' SHA-256 hashes, versions, and declared licenses.

The preview build checks the staged archive's file inventory and scans its contents. Private state paths and unsafe archive entries fail the inventory check. A secret finding fails the scan without printing the value. To check a retained archive without building or starting a registry, run the following.

```sh
bun tooling/scripts/check-package-registry.ts --verify-archive /tmp/titan-release/titan-cli-0.1.0-alpha.1.tgz
```

## Verified environment

| Item                 | Observed                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Build host           | Ubuntu 24.04.5 LTS, Linux x86-64, Bun 1.3.10                                                                                             |
| Registry and install | Debian GNU/Linux 13.3 container, Linux x86-64, Bun package manager 1.3.10                                                                |
| Preview archive      | `@titan/cli@0.1.0-alpha.1`, SHA-256 `1235993cb477497218963723bafdda340a2fe17eaba95a44d0774ae3321202a6`                                   |
| Dependency corpus    | 154 tarballs staged from installed Bun cache entries; the successful registry install reported 154 packages                              |
| Missing package      | The private registry returned HTTP 404 for `sqlite-vec`. Bun reported that `sqlite-vec@0.1.9` failed to resolve                          |
| Offline doctor       | The SQLite vector extension loaded into an in-memory database. Python, Lean, and local model files were missing. Live checks did not run |
| Archive rejection    | The integration suite rejected a synthetic token in the packaged README and a synthetic private run record in a shipped directory        |

The dependency archives for this run were assembled from locally installed package files. The hashes identify those staged copies. Upstream archive identity and a public registry package-scope ownership check remain open. The preview bundles Titan’s internal modules. The missing-package case exercises the required external dependency, leaving the OpenSpec scenario for a separately published internal package open.

Both installed launches completed the fake-backed example. The registry run was `90e3afef-0294-4593-845a-ef3aecca046f` and the archive run was `8554fc31-1020-4c04-91b1-bf0191bea45e`.

The focused offline suite passed 44 tests. The default invocation for that single file also passed the 44 tests, then exited 1 because the repository-wide coverage check requires the rest of the test suite.

## Optional native features

Offline doctor probes `sqlite-vec` in memory and reports it as optional. If loading fails, doctor identifies the OS and architecture, recommends reinstalling the matching native package, and points to word search while vector search is unavailable. Doctor checks local model files separately. Model downloads require an explicit `--fetch-model` request.

The offline test injects native loader and cleanup failures on Linux x86-64. The result verifies the diagnostic and fallback guidance. Native failure on a real unverified architecture, ONNX inference and model-backed search in this installation, and additional OS, architecture, Bun, and package-manager combinations remain unverified. The fake example exercises an offline workflow. Live vendor authentication has separate acceptance requirements.

Installation and update commands are in the [installation guide](install.md). The release requirements and scenarios are in the [distribution specification](../openspec/changes/resilient-agent-blackboard-bun/specs/distribution/spec.md).
