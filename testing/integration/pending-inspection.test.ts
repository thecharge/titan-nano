import { unit } from "@titan/test-factories";
import { pendingInspectionCases, pendingScopeCases } from "../cases/pending-inspection.ts";
import { pendingInspection, pendingScope } from "../factories/pending-inspection.ts";

unit(pendingInspection, pendingInspectionCases);
unit(pendingScope, pendingScopeCases);
