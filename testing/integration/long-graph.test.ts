import { LongGraphFixture } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { graphBudgetCases, longGraphCases } from "../cases/long-graph.ts";
import { longGraph } from "../factories/long-graph.ts";
import { graphBudget } from "../factories/long-graph-budget.ts";

unit(longGraph, longGraphCases, LongGraphFixture.CaseTimeout);

unit(graphBudget, graphBudgetCases);
