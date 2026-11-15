import { NativeToolBridgeFixture, NativeToolEnvironment, NativeToolRole } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const nativeBridgeEnvironmentCases = {
  positive: [
    positive(
      "worker environment retains its null part and scope",
      [NativeToolRole.Worker, null, ""],
      true,
    ),
    positive(
      "checker environment retains its named part and scope",
      [NativeToolRole.Checker, null, ""],
      true,
    ),
  ],
  negative: [
    rejected(
      "remote host cannot receive a native credential",
      [NativeToolRole.Worker, NativeToolEnvironment.Url, "http://example.invalid/native-tools"],
      true,
    ),
    rejected(
      "HTTPS cannot replace the internal loopback route",
      [NativeToolRole.Checker, NativeToolEnvironment.Url, "https://127.0.0.1/native-tools"],
      true,
    ),
    rejected(
      "a malformed URL fails before startup",
      [NativeToolRole.Worker, NativeToolEnvironment.Url, "invalid"],
      true,
    ),
    rejected(
      "a query cannot become a native connection setting",
      [
        NativeToolRole.Checker,
        NativeToolEnvironment.Url,
        "http://127.0.0.1/native-tools?scope=other",
      ],
      true,
    ),
    rejected(
      "an empty credential fails without disclosure",
      [NativeToolRole.Worker, NativeToolEnvironment.Token, ""],
      true,
    ),
    rejected(
      "an exponent cannot replace the logical attempt",
      [NativeToolRole.Checker, NativeToolEnvironment.Attempt, "1e0"],
      true,
    ),
    rejected(
      "zero cannot disable the startup deadline",
      [NativeToolRole.Worker, NativeToolEnvironment.Timeout, "0"],
      true,
    ),
    rejected(
      "a relative run folder fails validation",
      [NativeToolRole.Checker, NativeToolEnvironment.RunDirectory, "relative"],
      true,
    ),
  ],
};

export const nativeBridgeFlowCases = {
  positive: [
    positive(
      "worker bridge keeps edits private and closes on peer exit",
      [NativeToolRole.Worker, false],
      true,
    ),
    positive(
      "checker bridge reads final entries and closes on peer exit",
      [NativeToolRole.Checker, false],
      true,
    ),
  ],
  negative: [
    rejected("revoked worker cannot call through its bridge", [NativeToolRole.Worker, true], true),
    rejected(
      "revoked checker cannot call through its bridge",
      [NativeToolRole.Checker, true],
      true,
    ),
  ],
};

export const nativeBridgeStartupCases = {
  positive: [
    positive(
      "worker starts after exact readiness",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Ready],
      true,
    ),
    positive(
      "checker starts after exact readiness",
      [NativeToolRole.Checker, NativeToolBridgeFixture.Ready],
      true,
    ),
  ],
  negative: [
    rejected(
      "substituted execution cannot start a bridge",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Scope],
      true,
    ),
    rejected(
      "wrong readiness policy cannot start a bridge",
      [NativeToolRole.Checker, NativeToolBridgeFixture.ReadyTools],
      true,
    ),
    rejected(
      "wrong listed tools cannot start a bridge",
      [NativeToolRole.Worker, NativeToolBridgeFixture.ListedTools],
      true,
    ),
    rejected(
      "an error readiness result cannot start a bridge",
      [NativeToolRole.Checker, NativeToolBridgeFixture.NoReady],
      true,
    ),
    rejected(
      "malformed readiness cannot start a bridge",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Malformed],
      true,
    ),
    rejected(
      "stdio startup failure closes remote resources",
      [NativeToolRole.Checker, NativeToolBridgeFixture.Transport],
      true,
    ),
  ],
};

export const nativeBridgeCliCases = {
  positive: [
    positive(
      "tool-server uses its lifecycle service without result output",
      [["tool-server"], true],
      true,
    ),
    positive(
      "tool-server help does not start the native service",
      [["tool-server", "--help"], true],
      true,
    ),
  ],
  negative: [
    rejected("tool-server refuses ordinary JSON output", [["tool-server", "--json"], false], true),
    rejected(
      "tool-server refuses caller-supplied scope arguments",
      [["tool-server", "another-run"], false],
      true,
    ),
  ],
};

export const nativeStdioLifecycleCases = {
  positive: [
    positive("stdin EOF closes the transport and removes listeners", [false, false, false], true),
    positive("stdin already ended before startup still closes", [true, false, false], true),
  ],
  negative: [
    rejected("an oversized input frame closes within the byte bound", [false, true, false], true),
    rejected(
      "repeated startup fails and leaves no listeners after EOF",
      [false, false, true],
      true,
    ),
  ],
};

export const nativeHttpReadinessCases = {
  positive: [
    positive(
      "HTTP worker readiness closes and reconnects",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Ready],
      true,
    ),
    positive(
      "HTTP checker readiness closes and reconnects",
      [NativeToolRole.Checker, NativeToolBridgeFixture.Ready],
      true,
    ),
  ],
  negative: [
    rejected(
      "HTTP readiness refuses substituted scope",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Scope],
      true,
    ),
    rejected(
      "HTTP readiness refuses changed inventory",
      [NativeToolRole.Checker, NativeToolBridgeFixture.ListedTools],
      true,
    ),
    rejected(
      "HTTP readiness refuses changed role policy",
      [NativeToolRole.Worker, NativeToolBridgeFixture.ReadyTools],
      true,
    ),
    rejected(
      "HTTP readiness refuses a failed ready call",
      [NativeToolRole.Checker, NativeToolBridgeFixture.NoReady],
      true,
    ),
    rejected(
      "HTTP readiness refuses malformed owner data",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Malformed],
      true,
    ),
    rejected(
      "cancelled worker readiness sends no request",
      [NativeToolRole.Worker, NativeToolBridgeFixture.Ready, true],
      true,
    ),
    rejected(
      "cancelled checker readiness sends no request",
      [NativeToolRole.Checker, NativeToolBridgeFixture.Ready, true],
      true,
    ),
  ],
};
