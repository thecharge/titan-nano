import { positive, rejected } from "@titan/test-factories";

export const runtimeRecoveryCases = {
  positive: [
    positive("a build pin selects its exact retained bundle", ["build"], true),
    positive("connection recovery selects the exact build pin", ["build-connection"], true),
    positive("byte-identical retained copies remain recoverable", ["duplicate"], true),
    positive("an older run reaches its verified retained runtime", ["success"], true),
    positive("an idle daemon drains before retained-runtime handoff", ["idle"], true),
    positive(
      "an incompatible idle daemon drains before retained-runtime handoff",
      ["idle-version"],
      true,
    ),
    positive("client recovery connects to the verified retained runtime", ["connection"], true),
    positive("client recovery drains an incompatible idle owner", ["idle-connection"], true),
  ],
  negative: [
    rejected("a bundle changed by its version probe is refused", ["changed-build"], true),
    rejected(
      "connection recovery refuses a bundle changed during its probe",
      ["changed-build-connection"],
      true,
    ),
    rejected("an unavailable build pin preserves the runtime diagnostic", ["unknown-build"], true),
    rejected(
      "connection recovery refuses an unavailable build pin",
      ["unknown-build-connection"],
      true,
    ),
    rejected(
      "different same-version builds cannot be selected by directory order",
      ["ambiguous"],
      true,
    ),
    rejected(
      "connection recovery refuses ambiguous same-version builds",
      ["ambiguous-connection"],
      true,
    ),
    rejected("active work prevents retained-runtime handoff", ["busy"], true),
    rejected("a missing retained release preserves the original diagnostic", ["missing"], true),
    rejected(
      "a missing current executable preserves the runtime diagnostic",
      ["missing-entry"],
      true,
    ),
    rejected(
      "a missing stable launcher preserves the runtime diagnostic",
      ["missing-launcher"],
      true,
    ),
    rejected("a mismatched manifest cannot select a release", ["wrong-manifest"], true),
    rejected("a mismatched executable cannot select a release", ["wrong-binary"], true),
    rejected("a malformed executable cannot select a release", ["invalid-binary"], true),
    rejected("a linked executable outside its release is refused", ["linked"], true),
    rejected("an unmanaged executable cannot claim retained releases", ["unmanaged"], true),
    rejected("a pinned invocation cannot recursively hand off", ["pinned"], true),
    rejected("client recovery preserves missing-runtime diagnostics", ["missing-connection"], true),
    rejected("client recovery refuses a recursive pinned invocation", ["pinned-connection"], true),
  ],
};

export const runtimeHandoffCases = {
  positive: [
    positive("handoff preserves command arguments and the project directory", ["ordinary"], true),
    positive("retained-runtime handoff sets the invocation pin", ["pinned"], true),
  ],
  negative: [
    rejected("a failed child preserves its exit status", ["failed"], true),
    rejected("a missing child cannot report success", ["missing"], true),
  ],
};

export const daemonRuntimeHandoffCases = {
  positive: [
    positive("current commands replace an idle older runtime owner", ["older"], true),
    positive("retained commands replace an idle newer runtime owner", ["newer"], true),
  ],
  negative: [
    rejected("busy owners retain their process and admission", ["busy"], true),
    rejected("missing handoff services preserve the version diagnostic", ["unavailable"], true),
  ],
};

export const runtimeTransportRecoveryCases = {
  positive: [
    positive("agent requests retry once through the compatible owner", ["ordinary"], true),
    positive("person requests retain their authority through recovery", ["owner"], true),
  ],
  negative: [
    rejected("unavailable runtime recovery preserves the original error", ["missing"], true),
    rejected("a refused runtime does not retry the operation", ["refused"], true),
    rejected("a repeated mismatch cannot recursively retry", ["repeated"], true),
    rejected("an unrelated error cannot invoke runtime recovery", ["unrelated"], true),
    rejected("active work prevents a recovery retry", ["busy"], true),
  ],
};

export const runtimeMcpRecoveryCases = {
  positive: [
    positive("MCP run tools recover through the compatible owner", ["run"], true),
    positive("MCP request tools recover through the compatible owner", ["request"], true),
  ],
  negative: [
    rejected("MCP retains an unavailable-runtime refusal", ["refused"], true),
    rejected("MCP does not loop on a repeated runtime mismatch", ["repeated"], true),
  ],
};

export const runtimeDefaultConnectionCases = {
  positive: [
    positive("default run clients connect through daemon discovery", ["run"], true),
    positive("default request clients connect through daemon discovery", ["request"], true),
  ],
  negative: [
    rejected("default run clients retain missing-runtime diagnostics", ["missing-run"], true),
    rejected(
      "default request clients retain missing-runtime diagnostics",
      ["missing-request"],
      true,
    ),
  ],
};

export const runtimeBuildServerCases = {
  positive: [
    positive("the creating daemon build inspects its retained run", ["matching"], true),
    positive("an unpinned legacy run remains readable", ["legacy"], true),
  ],
  negative: [
    rejected("another daemon build returns the exact required hash", ["different"], true),
    rejected("an unbundled daemon refuses a build-pinned run", ["missing"], true),
  ],
};
