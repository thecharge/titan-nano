import { unit } from "@titan/test-factories";
import { prerequisiteVersionCases } from "../cases/prerequisite-version.ts";
import { bunReadiness } from "../factories/prerequisite-version.ts";

unit(bunReadiness, prerequisiteVersionCases);
