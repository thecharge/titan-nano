import { unit } from "@titan/test-factories";
import { helperRecoveryCases, helperTurnCases } from "../cases/helper-turns.ts";
import { helperRecovery, helperTurns } from "../factories/helper-turns.ts";

unit(helperTurns, helperTurnCases);
unit(helperRecovery, helperRecoveryCases);
