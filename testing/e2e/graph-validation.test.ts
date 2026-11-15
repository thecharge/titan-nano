import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { graphValidationCases } from "../cases/graph-validation.ts";
import { graphValidation } from "../factories/graph-validation.ts";

unit(graphValidation, graphValidationCases, undefined, TestSchedule.Concurrent);
