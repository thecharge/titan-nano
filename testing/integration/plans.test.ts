import { unit } from "@titan/test-factories";
import { plansBeforeDesignCases, plansCommandCases } from "../cases/plans.ts";
import { plansBeforeDesign, plansCommand } from "../factories/plans.ts";

unit(plansBeforeDesign, plansBeforeDesignCases);
unit(plansCommand, plansCommandCases);
