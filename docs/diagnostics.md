# Operational diagnostics

Titan keeps durable workflow history in each run journal. Operational diagnostics explain server lifecycle and unexpected background failures. They do not contain prompts, answers, paths or arbitrary error text.

## Configure the owner

Put logging settings in `config.yaml` under the engine home selected by `--home`. Project, workflow and CLI overrides cannot change this section.

```yaml
server:
  logging:
    level: info
    max_pending: 128
    max_record_bytes: 4096
    write_timeout_ms: 1000
```

Levels are debug, info, warn, error and off. The default is warn. Ordinary startup, settlement and shutdown records use info; unexpected failures use error. Existing configurations without logging retain their saved shape.

The pending count includes active and queued writes. Its maximum is 1024. Record bytes range from 128 to 4096; the default is 4096. The deadline ranges from 1 to 5000 milliseconds; the default is 1000. These are finite safety limits, not measured production capacity claims.

## Read the output

Diagnostics are versioned JSON lines on stderr. Stdout stays available for CLI results and MCP framing. A record has time, process id, level and event. Run, node, phase and execution identities appear when available. Failure codes come from the shared error registry. Unknown fields and known secret values are refused before writing.

The authenticated `GET /health` response includes diagnostic counters: written, filtered, rejected and failed, plus disabled. Use the local address and bearer token from the private engine address record. These counters describe the current process and reset on restart.

An incomplete, failed or timed-out sink write increments failed and disables later writes. This keeps an incomplete JSON prefix at the end of the stream and prevents abandoned writes from accumulating. Restart the server after repairing its diagnostic sink. Saturation, invalid records, oversized records and secret matches increment rejected. These failures cannot change a workflow's verdict or quality attempt. Inspect the journal for durable run state.

## Verification

Run `bun run test` for the full offline suite. Shared logger cases verify bounded admission, order, safe records and failing sinks. Server cases compare health counters and passed runs under sink failure. Process cases verify real stderr output and one framed stdout result. Vendors remain stubbed.
