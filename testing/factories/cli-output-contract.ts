import { strict as assert } from "node:assert";
import { CliCommand, DataKind } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CliOutputSchema, type EventPage } from "@titan/types";
import { renderCommandOutput } from "../../apps/cli/src/bootstrap.ts";
import { failureEnvelope } from "../../apps/cli/src/output.ts";

export function cliOutputRenderer(
  value: unknown,
  json: boolean,
  operation?: string,
  events?: EventPage,
  human?: string,
): boolean {
  const output: string[] = [];
  const context = operation ? { operation, ...(events ? { events } : {}) } : undefined;
  renderCommandOutput(value, json, context, (line) => output.push(String(line)));
  assert.equal(output.length, 1);
  if (human !== undefined) {
    assert.equal(output[0], human);
    return true;
  }
  if (json && operation && operation !== CliCommand.Serve) {
    const envelope = CliOutputSchema.parse(JSON.parse(output[0] ?? ""));
    assert.deepEqual(envelope.data, value ?? null);
    assert.equal(envelope.operation, operation);
    if (events) assert.deepEqual(envelope.events, events.events);
  } else {
    const expected = json
      ? JSON.stringify(value)
      : typeof value === DataKind.String
        ? value
        : JSON.stringify(value, null, 2);
    assert.equal(output[0], expected);
  }
  return true;
}

export function cliOutputFailure(error: unknown, operation: string) {
  const envelope = failureEnvelope(error, operation);
  assert.deepEqual(envelope.error.paths, error instanceof TitanError ? error.paths : []);
  return {
    code: envelope.error.code,
    retryable: envelope.error.retryable,
    action: envelope.error.recovery?.action ?? null,
    run_id: envelope.identifiers.run_id,
    submission_id: envelope.identifiers.submission_id,
    state: envelope.state,
  };
}

export function cliOutputContract(value: unknown): boolean {
  return CliOutputSchema.safeParse(value).success;
}
