# @titan/logger

## Responsibilities

Owns bounded asynchronous operational diagnostics. The run journal owns durable workflow history.

## Public contract

`createLogger` validates settings and returns asynchronous `write` and `statistics` methods. Strict versioned JSON lines use declared levels, events and bounded execution identities. The default sink writes Buffer data to stderr through Bun's asynchronous write API. It leaves stdout for CLI results and protocol framing. Configuration owns secret scanning; the optional additional guard supports controlled composition and tests. It cannot disable the central secret check.

Writes are serialized through the shared bounded queue. Full admission, invalid or oversized records and secret matches return false and increment rejected. Sink exceptions, partial writes and timeouts increment failed and disable later writes. An incomplete JSON prefix remains the final record. A stuck sink cannot accumulate further outstanding operations. Statistics distinguish written, filtered, rejected and failed records. They retain finite safe-integer values.

## Verification

Use shared offline logger cases for records, level filtering, byte bounds, queue saturation, ordered concurrent writes, sink failures and deadlines. Server cases exercise owner settings, lifecycle records and authenticated health statistics. Process probes verify stderr output independently of stdout.

## Limits

Diagnostics are best-effort operational output. They cannot grant authority, change quality results or replace the journal. A timed-out underlying sink operation may remain outstanding until the operating system settles it. The logger disables further writes after any sink failure to keep that count bounded and prevent later records from following an incomplete prefix. Restarting the owner creates a new logger. It does not persist diagnostics or send them over a network. Unknown error text, task contents and file paths are not accepted record fields.
