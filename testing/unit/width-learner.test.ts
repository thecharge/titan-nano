import { unit } from "@titan/test-factories";
import { widthEligibleCases, widthFirstCases, widthTrailCases } from "../cases/width-learner.ts";
import { widthEligible, widthFirst, widthTrails } from "../factories/width-learner.ts";

unit(widthTrails, widthTrailCases);
unit(widthEligible, widthEligibleCases);
unit(widthFirst, widthFirstCases);
