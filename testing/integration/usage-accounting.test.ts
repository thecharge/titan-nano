import { unit } from "@titan/test-factories";
import { incrementalUsageCases, usageAccountingCases } from "../cases/usage-accounting.ts";
import { reconciliationUsageCases, usageSemanticsCases } from "../cases/usage-semantics.ts";
import { incrementalUsage, usageAccounting } from "../factories/usage-accounting.ts";
import { reconciliationUsage, usageSemantics } from "../factories/usage-semantics.ts";

unit(usageAccounting, usageAccountingCases);
unit(incrementalUsage, incrementalUsageCases);
unit(usageSemantics, usageSemanticsCases);
unit(reconciliationUsage, reconciliationUsageCases);
