import { BoundaryRule, PackageLayer } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const dependencyDirectionCases = {
  positive: [
    positive(
      "native test fixtures may import the Claude SDK",
      ["@titan/testing", "@anthropic-ai/claude-agent-sdk", PackageLayer.Test],
      undefined,
    ),
    positive(
      "native test fixtures may import the Codex SDK",
      ["@titan/testing", "@openai/codex-sdk", PackageLayer.Test],
      undefined,
    ),
    positive(
      "test aggregation depends on shared factories",
      ["@titan/testing", "@titan/test-factories", PackageLayer.Test],
      undefined,
    ),
    positive(
      "test aggregation depends on its framework",
      ["@titan/testing", "@titan/test-framework", PackageLayer.Test],
      undefined,
    ),
    positive("core may depend on shared types", ["@titan/core", "@titan/types"], undefined),
    positive("core may depend on messages", ["@titan/core", "@titan/messages"], undefined),
    positive(
      "Codex adapter may use its SDK",
      ["@titan/backend-codex", "@openai/codex-sdk"],
      undefined,
    ),
    positive(
      "Claude adapter may use its SDK",
      ["@titan/backend-claude", "@anthropic-ai/claude-agent-sdk"],
      undefined,
    ),
    positive("fake adapter may use core ports", ["@titan/backend-fake", "@titan/core"], undefined),
    positive(
      "runtime composes concrete adapters",
      ["@titan/runtime", "@titan/backend-codex"],
      undefined,
    ),
    positive(
      "test aggregation can exercise adapters",
      ["@titan/testing", "@titan/backend-claude", PackageLayer.Test],
      undefined,
    ),
    positive(
      "shared test factories can exercise adapters",
      ["@titan/test-factories", "@titan/backend-codex", PackageLayer.Test],
      undefined,
    ),
    positive(
      "test factories depend on their framework",
      ["@titan/test-factories", "@titan/test-framework", PackageLayer.Test],
      undefined,
    ),
  ],
  negative: [
    rejected(
      "core cannot acquire a vendor SDK",
      ["@titan/core", "@openai/codex-sdk"],
      BoundaryRule.CoreDirection,
    ),
    rejected(
      "core cannot acquire arbitrary external dependencies",
      ["@titan/core", "some-library"],
      BoundaryRule.CoreDirection,
    ),
    rejected(
      "runner cannot acquire the Claude SDK directly",
      ["@titan/runner", "@anthropic-ai/claude-agent-sdk"],
      BoundaryRule.VendorIsolation,
    ),
    rejected(
      "server cannot acquire the Codex SDK directly",
      ["@titan/server", "@openai/codex-sdk"],
      BoundaryRule.VendorIsolation,
    ),
    rejected(
      "framework cannot depend on factories",
      ["@titan/test-framework", "@titan/test-factories", PackageLayer.Test],
      BoundaryRule.TestDirection,
    ),
    rejected(
      "factories cannot depend on aggregation",
      ["@titan/test-factories", "@titan/testing", PackageLayer.Test],
      BoundaryRule.TestDirection,
    ),
    rejected(
      "runner cannot depend on Claude",
      ["@titan/runner", "@titan/backend-claude"],
      BoundaryRule.AdapterComposition,
    ),
    rejected(
      "server cannot depend on Codex",
      ["@titan/server", "@titan/backend-codex"],
      BoundaryRule.AdapterComposition,
    ),
    rejected(
      "CLI handlers cannot compose a concrete adapter",
      ["@titan/cli", "@titan/backend-codex"],
      BoundaryRule.AdapterComposition,
    ),
    rejected(
      "core cannot depend on runner",
      ["@titan/core", "@titan/runner"],
      BoundaryRule.CoreDirection,
    ),
    rejected(
      "core cannot depend on an adapter",
      ["@titan/core", "@titan/backend-claude"],
      BoundaryRule.CoreDirection,
    ),
    rejected(
      "adapter cannot depend on workflow",
      ["@titan/backend-codex", "@titan/workflow"],
      BoundaryRule.AdapterDirection,
    ),
    rejected(
      "adapter cannot use a peer vendor SDK",
      ["@titan/backend-claude", "@openai/codex-sdk"],
      BoundaryRule.AdapterDirection,
    ),
    rejected(
      "fake adapter cannot introduce a vendor SDK",
      ["@titan/backend-fake", "@openai/codex-sdk"],
      BoundaryRule.AdapterDirection,
    ),
    rejected(
      "runner cannot depend on test factories",
      ["@titan/runner", "@titan/test-factories"],
      BoundaryRule.TestDirection,
    ),
    rejected(
      "server cannot depend on test aggregation",
      ["@titan/server", "@titan/testing"],
      BoundaryRule.TestDirection,
    ),
  ],
};

export const packageIdentityCases = {
  positive: [
    positive(
      "test framework retains its registered directory",
      ["testing/packages/framework", "@titan/test-framework"],
      true,
    ),
    positive(
      "test factories retain their registered directory",
      ["testing/packages/factories", "@titan/test-factories"],
      true,
    ),
    positive(
      "runtime name belongs to runtime directory",
      ["packages/runtime", "@titan/runtime"],
      true,
    ),
    positive(
      "Codex name belongs to its adapter directory",
      ["packages/backend-codex", "@titan/backend-codex"],
      true,
    ),
  ],
  negative: [
    rejected(
      "ordinary library cannot move into applications",
      ["apps/runner", "@titan/runner"],
      false,
    ),
    rejected(
      "ordinary library cannot move into test packages",
      ["testing/packages/runner", "@titan/runner"],
      false,
    ),
    rejected(
      "adapter cannot masquerade as an application",
      ["apps/backend-codex", "@titan/backend-codex"],
      false,
    ),
    rejected(
      "test framework cannot move into product packages",
      ["packages/test-framework", "@titan/test-framework"],
      false,
    ),
    rejected(
      "ordinary library cannot impersonate runtime",
      ["packages/runner", "@titan/runtime"],
      false,
    ),
    rejected(
      "ordinary library cannot impersonate an adapter",
      ["packages/workflow", "@titan/backend-codex"],
      false,
    ),
  ],
};

export const vendorOwnerCases = {
  positive: [
    positive("Codex SDK belongs to Codex", ["@openai/codex-sdk"], "@titan/backend-codex"),
    positive("Codex executable belongs to Codex", ["@openai/codex"], "@titan/backend-codex"),
    positive(
      "Claude SDK belongs to Claude",
      ["@anthropic-ai/claude-agent-sdk"],
      "@titan/backend-claude",
    ),
  ],
  negative: [
    rejected("ordinary library has no vendor role", ["zod"], undefined),
    rejected("similarly named SDK has no vendor role", ["@openai/codex-sdk-extra"], undefined),
  ],
};
