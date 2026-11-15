import { unit } from "@titan/test-factories";
import { splitWidthCases } from "../cases/split-width.ts";
import { splitWidth } from "../factories/split-width.ts";

unit(splitWidth, splitWidthCases);
