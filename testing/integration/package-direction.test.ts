import { unit } from "@titan/test-factories";
import { packageDirectionTreeCases } from "../cases/package-direction-tree.ts";
import { packageDirectionTree } from "../factories/package-direction.ts";

unit(packageDirectionTree, packageDirectionTreeCases);
