import { unit } from "@titan/test-factories";
import { storedJsonCases } from "../cases/board-json.ts";
import { storedJson } from "../factories/board-json.ts";

unit(storedJson, storedJsonCases);
