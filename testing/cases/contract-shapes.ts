import { RequestKind, RequestLimit } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const manifest = { name: "@fixture/root" };
const workspaces = { packages: ["packages/*"], catalog: { zod: "4.3.6" } };
const defaults = { ...manifest, dependencies: {}, devDependencies: {} };
const emptyWorkspaces = { packages: [], catalog: {} };
const declared = { ...defaults, workspaces };
const emptyInput = { ...manifest, workspaces: {} };
const emptyDeclared = { ...defaults, workspaces: emptyWorkspaces };
const escaped = { packages: ["../packages/*"] };
const badCatalog = { catalog: { zod: 3 } };

export const hookManifestContractCases = {
  positive: [
    positive("present empty workspace metadata retains defaults", [emptyInput], emptyDeclared),
    positive("omitted workspace metadata retains compatibility", [manifest], defaults),
    positive(
      "declared packages and pinned catalog remain valid",
      [{ ...manifest, workspaces }],
      declared,
    ),
  ],
  negative: [
    rejected(
      "workspace pattern cannot escape its owner",
      [{ ...manifest, workspaces: escaped }],
      null,
    ),
    rejected("catalog versions remain strings", [{ ...manifest, workspaces: badCatalog }], null),
  ],
};

const plain = { result: "done", requests: [] };
const integer = { type: "integer" };
const typed = { result: 3, requests: [] };
const omitted = { result: "done" };
const extra = { ...plain, extra: true };
const waiting = { result: null, requests: [] };
const scope = {
  operation: "read",
  resource: "document",
  content_hashes: {},
  arguments: [],
  environment_names: [],
};
const request = { kind: RequestKind.Ask, scope, expires_at: 1000 };
const single = { result: null, requests: [request] };
const maximum = {
  result: null,
  requests: Array.from({ length: RequestLimit.PerRun }, () => request),
};
const exceeded = { result: null, requests: [...maximum.requests, request] };
const malformed = { result: null, requests: [{ ...request, kind: "unknown" }] };
export const requestTurnContractCases = {
  positive: [
    positive("scoped request retains its strict item contract", [null, single], true),
    positive("request count may reach its central ceiling", [null, maximum], true),
    positive("default result accepts text", [null, plain], true),
    positive("typed result retains its integer constraint", [integer, typed], true),
    positive("null result remains available to request turns", [integer, waiting], true),
  ],
  negative: [
    rejected("request count cannot exceed its central ceiling", [null, exceeded], false),
    rejected("request kind cannot bypass its schema", [null, malformed], false),
    rejected("requests field remains required", [null, omitted], false),
    rejected("extra envelope field remains forbidden", [null, extra], false),
    rejected("typed result cannot become arbitrary text", [integer, plain], false),
  ],
};
