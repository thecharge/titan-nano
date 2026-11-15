import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { policyKindCases, rewardCases } from "../cases/policy.ts";
import { recordedReward, workflowPolicyFile } from "../factories/policy.ts";

unit(workflowPolicyFile, policyKindCases, undefined, TestSchedule.Concurrent);
unit(recordedReward, rewardCases, undefined, TestSchedule.Concurrent);
