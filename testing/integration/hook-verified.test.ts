import { unit } from "@titan/test-factories";
import { verifiedTreeCases } from "../cases/hook-verified.ts";
import { verifiedTree } from "../factories/hook-verified.ts";

unit(verifiedTree, verifiedTreeCases);
