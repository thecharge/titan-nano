# Installed lifecycle and Claude acceptance

The preview scope is managed install, update, uninstall and reinstall on the verified Linux and Bun configuration. The Claude cases exercise the existing pinned Claude Agent SDK adapter through a local executable stub.

## Titan self-delivery

| Run                                    | Observed result                                                                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `57628a07-f384-4c0c-bf0d-32e3036eeba1` | The distribution worker wrote the registry gate. The older installed controller stopped at Codex reviewer schema validation.                                                                                          |
| `7361013a-a204-4e5d-ac57-b6bdbf81ddd5` | The Claude worker added offline adapter coverage. The lifecycle reviewer found that uninstall could stop another installation's daemon. Titan reverted that lifecycle candidate.                                      |
| `8b8a4d94-d5c5-46f0-b384-07e41f1d950f` | A newer installed controller ran the correction and review. The reviewer confirmed the foreign-daemon fix and found that uninstall still missed an active standalone knowledge writer. Titan reverted that candidate. |

The final increment recovered the corrected candidate and added the missing knowledge lease check and its regression case. It also repaired the test fixture's reads under the normal container's read-only mounts and invokes the command directly for source coverage.

Use `titan status RUN_ID --compact` in the originating home for the run state. The identifiers above refer to local run data. This record contains the public-facing findings and excludes the private journals.

## Verification scope

The lifecycle cases exercise the managed launcher across install, update, uninstall and reinstall. After reinstall they check preserved settings and knowledge and verify recovery of a run pinned to the earlier release. Refusal cases cover a separate installation's idle daemon, an active run, standalone server and knowledge writers, maintenance, and a replaced PATH link. An installed package without a managed launcher receives the package-manager removal command.

See the [distribution checks](../../../../docs/distribution.md) for the Linux registry evidence and remaining package-scope and platform work. See the [Claude adapter guide](../../../../packages/backend-claude/README.md#verification) for setup and the pinned subprocess cases. Live Claude authentication and vendor continuation still require the separate live check in task 6.3.

The focused offline runs passed 132 lifecycle, update and distribution cases and 72 Claude transport, request and process cases. Both focused commands still require complete product coverage.
