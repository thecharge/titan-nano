import { unit } from "@titan/test-factories";
import { claudeCreditCases } from "../cases/claude-credit.ts";
import { claudeCredit } from "../factories/claude-credit.ts";

unit(claudeCredit, claudeCreditCases);
