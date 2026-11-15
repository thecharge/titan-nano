import { SdkProcessFixture, TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { claudeBackoffCases } from "../cases/claude-backoff.ts";
import { claudeBackoff } from "../factories/claude-backoff.ts";

unit(claudeBackoff, claudeBackoffCases, SdkProcessFixture.CaseTimeout, TestSchedule.Concurrent);
