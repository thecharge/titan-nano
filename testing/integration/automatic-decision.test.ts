import { unit } from "@titan/test-factories";
import { automaticDecisionCases } from "../cases/automatic-decision.ts";
import { automaticDecision } from "../factories/automatic-decision.ts";

unit(automaticDecision, automaticDecisionCases);
