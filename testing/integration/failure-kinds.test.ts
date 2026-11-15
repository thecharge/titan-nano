import { unit } from "@titan/test-factories";
import { failureKindAnswerCases, failureKindCountsCases } from "../cases/failure-kinds.ts";
import { failureKindAnswer, failureKindCounts } from "../factories/failure-kinds.ts";

unit(failureKindCounts, failureKindCountsCases);
unit(failureKindAnswer, failureKindAnswerCases);
