import { unit } from "@titan/test-factories";
import { leanAnswerCases, leanFolderCases, leanLimitCases } from "../cases/lean-check.ts";
import { leanAnswer, leanFolder, leanLimit } from "../factories/lean-check.ts";

unit(leanAnswer, leanAnswerCases);
unit(leanFolder, leanFolderCases);
unit(leanLimit, leanLimitCases);
