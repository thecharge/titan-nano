import { strict as assert } from "node:assert";
import {
  ApprovalLevel,
  RequestDecision,
  RequestEscalationClientFixture,
  RequestLimit,
  RequestVersion,
} from "@titan/constants";
import { createRequestClient } from "@titan/server/requests";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { RequestEscalationSubmission } from "@titan/types";
import { withClientAddress } from "../support/client.ts";
import { requestPageRecord } from "./request-pages.ts";

function reason(): string {
  return "Reviewed";
}

export async function requestEscalationClient(mode: RequestEscalationClientFixture) {
  const input: RequestEscalationSubmission = {
    run_id: "selected",
    request_id: "permission",
    version: RequestVersion.Open,
    reason: reason(),
    client_id: "main-reviewer",
  };
  const record = requestPageRecord(input.run_id, input.request_id);
  record.version = RequestVersion.Escalated;
  record.level = ApprovalLevel.Human;
  record.escalation = {
    reason: input.reason,
    actor: { client_id: input.client_id, authority: ApprovalLevel.Main },
    escalated_at: 1200,
  };
  if (mode === RequestEscalationClientFixture.Retry) {
    input.reason = "Reviewed again";
    record.escalation.reason = input.reason;
  }
  if (mode === RequestEscalationClientFixture.Reason) record.escalation.reason = "substituted";
  if (mode === RequestEscalationClientFixture.Actor)
    record.escalation.actor.client_id = "substituted";
  if (mode === RequestEscalationClientFixture.Authority)
    record.escalation.actor.authority = ApprovalLevel.Human;
  if (mode === RequestEscalationClientFixture.Version) input.version = RequestVersion.Escalated;
  if (mode === RequestEscalationClientFixture.Answered) {
    record.version = RequestVersion.EscalatedAnswered;
    record.answer = {
      decision: RequestDecision.Approve,
      reason: "Answered",
      actor: { client_id: "person", authority: ApprovalLevel.Human },
      decided_at: 1400,
    };
  }
  if (mode === RequestEscalationClientFixture.MissingAudit) {
    delete record.escalation;
    record.version = RequestVersion.Open;
  }
  if (mode === RequestEscalationClientFixture.Invalid) input.reason = "";
  if (mode === RequestEscalationClientFixture.Oversized)
    input.reason = "x".repeat(RequestLimit.InputBytes);
  if (mode === RequestEscalationClientFixture.Accessor)
    Object.defineProperty(input, "reason", { enumerable: true, get: reason });
  const use = async (home: string) => {
    const result = await createRequestClient(home).escalate(input);
    assert.deepEqual(result, record);
    return true;
  };
  if (
    [
      RequestEscalationClientFixture.Invalid,
      RequestEscalationClientFixture.Oversized,
      RequestEscalationClientFixture.Accessor,
    ].includes(mode)
  )
    return withTemporaryDirectory(use);
  return withClientAddress(Response.json(record), use);
}
