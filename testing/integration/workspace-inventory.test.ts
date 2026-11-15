import { unit } from "@titan/test-factories";
import { workspaceInventoryCases } from "../cases/workspace-inventory.ts";
import { workspaceInventory } from "../factories/workspace-inventory.ts";

unit(workspaceInventory, workspaceInventoryCases);
