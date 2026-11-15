import { expect, test } from "bun:test";
import { unit } from "@titan/test-factories";
import { catalogDecisionCases } from "../cases/catalog-decisions.ts";
import { catalogDecisions, repositoryCatalogDecisions } from "../factories/catalog-decisions.ts";

unit(catalogDecisions, catalogDecisionCases);
test("the real catalog packages are all named in design.md", async () => {
  expect(await repositoryCatalogDecisions()).toEqual([]);
});
