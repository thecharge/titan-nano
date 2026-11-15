import { unit } from "@titan/test-factories";
import {
  inventoryStabilityCases,
  runtimeOmissionsCases,
  treeStabilityCases,
} from "../cases/tree-stability.ts";
import {
  inventoryStability,
  runtimeOmissions,
  treeStability,
} from "../factories/tree-stability.ts";

unit(treeStability, treeStabilityCases);

unit(runtimeOmissions, runtimeOmissionsCases);

unit(inventoryStability, inventoryStabilityCases);
