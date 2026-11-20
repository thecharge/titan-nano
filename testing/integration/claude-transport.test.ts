import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  claudeContinuationCases,
  claudeIdentityCases,
  claudeIsolationCases,
  claudePersonaCases,
  claudeRecoveryCases,
  claudeRetryFieldsCases,
  claudeRetryRecoveryCases,
  claudeTransportCases,
} from "../cases/claude-transport.ts";
import {
  claudeContinuation,
  claudeIdentity,
  claudeIsolation,
  claudePersona,
  claudeRecovery,
  claudeRetryFields,
  claudeRetryRecovery,
  claudeTransport,
} from "../factories/claude-transport.ts";

unit(claudeTransport, claudeTransportCases, undefined, TestSchedule.Concurrent);

unit(claudePersona, claudePersonaCases, SdkProcessFixture.CaseTimeout);

unit(claudeIsolation, claudeIsolationCases, undefined, TestSchedule.Concurrent);

unit(claudeContinuation, claudeContinuationCases);

unit(claudeRecovery, claudeRecoveryCases);

unit(claudeIdentity, claudeIdentityCases);

unit(claudeRetryRecovery, claudeRetryRecoveryCases);

unit(claudeRetryFields, claudeRetryFieldsCases);
