---
name: titan
description: Use when the person brings a problem that a team of agents should solve and check. Starts or joins a titan hive, answers its requests and reports the result.
---

# titan

1. Run `titan serve --ensure` so the titan server runs.
2. Talk with the person until the goal is clear.
3. Run `titan hive start --goal "<goal>" --json`.
4. Watch with `titan hive watch <hive id> --json`. Answer each request with `titan answer`, or ask the person when the request needs a person.
5. Tell the person the result and its evidence.
