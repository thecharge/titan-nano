# Continuous integration verification

## Primary evidence

Checked on 2026-11-08:

- The [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) describes push and pull request events, job permissions and failure propagation. The workflow uses both events without branch or path filters.
- The [Ubuntu 24.04 runner inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) lists Podman 4.9.3. Titan names that operating-system release instead of following ubuntu-latest. The runner inventory changes independently; successful remote execution still needs observation.
- The [checkout action definition](https://github.com/actions/checkout/blob/d23441a48e516b6c34aea4fa41551a30e30af803/action.yml) uses Node 24 and supports persist-credentials. The selected v6.1.0 revision was resolved through Git's remote tag inventory and is pinned by its full commit identifier. Checkout retains the event's default revision and does not persist its token.
- The [Bun setup action definition](https://github.com/oven-sh/setup-bun/blob/0c5077e51419868618aeaa5fe8019c62421857d6/action.yml) supports bun-version-file and uses Node 24. Its v2 revision was resolved through Git's remote tag inventory. The action reads package.json and receives an empty optional token. No vendor secret or live-test variable is supplied.

## Required behavior

Install the frozen dependency lock, fetch the exact pinned test base image and prepare the offline test image. Then run bun run check, which exports and verifies the checked-out Git index through the same gate as local commits. Setup may download dependencies and build the image. Product tests retain the offline Podman network, CPU, memory and process limits.

The workflow policy belongs to the existing hook policy owner. Strict schemas reject missing events, filters, extra environment or secret inputs, mutable action tags, retained credentials, ignored failures and a replacement of the complete gate with selected tests. Local fixtures execute actual passing and failing Bun test processes inside the offline boundary. Only unrelated check processes are substituted in that fixture. The gate must retain the real test status and the captured output must name the test. Existing hook fixtures separately exercise every registered failing stage.

No known failing commit is pushed to prove failure propagation. Local fixtures are not evidence of a successful GitHub runner, branch protection, merge enforcement or release automation. Those outcomes require their own observations and controls.

## Remote timing counterexample

The first actual [GitHub run](https://github.com/thecharge/titan-nano/actions/runs/42431607815) for d2523da failed three SDK case deadlines after passing setup and 1730 tests. Both successful two-origin mixed workflows exceeded fifteen seconds and Claude active descendant recovery exceeded five seconds. No secret, live-vendor variable or network access was added to the test boundary.

The repair reduces native host schema initialization and mixed-workflow observation traffic, and schedules independent active recovery cases serially. It retains every scenario, real child process, within-workflow parallel wave, deadline and resource limit. Local timing improvements alone do not close remote acceptance. The next complete pushed revision must pass GitHub before task 2.13 is marked complete.

The repaired revision d21be3962c494460dd7b5fb23ba77c9e80f23a49 passed its actual [complete GitHub run](https://github.com/thecharge/titan-nano/actions/runs/42433313121). Frozen installation, pinned image preparation and bun run check all succeeded. The job ran from 01:13:33 to 01:17:19 UTC on 2026-11-08. The local failure-propagation fixtures and actual remote successful execution now satisfy task 2.13. Repository branch protection and release automation remain separate unconfigured controls.

The request-origin revision 0b0fb6c74a7a4dae23e12f196b790b0e670de39b also passed its actual [complete GitHub run](https://github.com/thecharge/titan-nano/actions/runs/42434683416). All 1756 tests across 97 files passed in 162.37 seconds, with 171 product sources and no measured gaps. The complete test command exited zero in 162.943 seconds. This verifies that increment with offline vendor fixtures; it does not establish native request waiting or product readiness.
