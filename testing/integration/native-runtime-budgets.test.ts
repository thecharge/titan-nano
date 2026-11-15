import { unit } from "@titan/test-factories";
import { frozenNativeBudgetCases } from "../cases/native-runtime-budgets.ts";
import { frozenNativeBudget } from "../factories/native-runtime-budgets.ts";

unit(frozenNativeBudget, frozenNativeBudgetCases);
