import { unit } from "@titan/test-factories";
import { vendorFixturePreparationCases } from "../cases/vendor-fixtures.ts";
import { vendorFixturePreparation } from "../factories/vendor-fixtures.ts";

unit(vendorFixturePreparation, vendorFixturePreparationCases);
