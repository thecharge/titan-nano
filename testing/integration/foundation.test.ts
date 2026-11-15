import { afterEach, describe, test } from "bun:test";
import {
  foundationCommandInventory,
  foundationConfigLimits,
  foundationContractCleanup,
  foundationFormatMismatch,
  foundationGroupDepth,
  foundationInvalidDependencies,
  foundationInvalidWorkflow,
  foundationLayeredSettings,
  foundationMixedDependencies,
  foundationSiblingInputs,
  foundationStrictWorkspaces,
  foundationUnorderedGraph,
} from "../factories/foundation-contract.ts";

afterEach(foundationContractCleanup);
describe("foundation", () => {
  test("every registered command name is unique and exposed", foundationCommandInventory);
  test("configuration defaults and owner limits", foundationConfigLimits);
  test("workflow absence does not replace user settings", foundationLayeredSettings);
  test(
    "nested sequence then parallel then join compiles dependencies",
    foundationMixedDependencies,
  );
  test("graph presentation order does not impose execution order", foundationUnorderedGraph);
  test(
    "cycles, missing dependencies and duplicate IDs fail before execution",
    foundationInvalidDependencies,
  );
  test(
    "missing goal, unknown fields, missing checker and self-check fail",
    foundationInvalidWorkflow,
  );
  test("parallel sibling input is rejected", foundationSiblingInputs);
  test("group depth is bounded", foundationGroupDepth);
  test("input and output formats must agree", foundationFormatMismatch);
  test("all packages extend strict root options", foundationStrictWorkspaces);
});
