export const RequestMessage = {
  OutsideLimits:
    "Only an open add_step request inside the step limit can be decided by titan alone",
  Execution: "Request does not match the active agent execution",
  Decision: "Choose approve, deny, --yes, --deny, --persona or --to-person for one request answer",
  Accepted: "Accepted the scoped request",
  PersonaSupplied: "Approved the supplied persona definition",
  EscalateTool:
    "Pass a pending main-level request to the person with its observed version, explicit client and reason. This preserves scope and does not continue a native session.",
  Escalation: "Only a pending main-level request can pass to the person",
  ListTool:
    "List bounded request pages across runs with explicit run, client, harness-session and project filters. Origin labels are navigation filters, not access control.",
  PageQuery:
    "Request listing requires valid origin filters, a bounded count and a cursor from the same filters",
  Page: "Request listing page does not match its filters, cursor, count or byte allowance",
  OpenTool:
    "Open a scoped request and return its waiting or answered state immediately. This does not execute an operation or continue an agent session.",
  ReadTool: "Inspect one request by its exact run and request ids.",
  AnswerTool:
    "Answer a main-level request using its observed version, explicit client and reason. Human approvals require the person command.",
  Client: "Request response does not match the selected operation",
  Options:
    "Supply --request-version with a positive safe integer and --client-id with an identifier",
  Reason: "Supply a nonempty reason within the request text allowance",
  Invalid: "Request does not match its schema",
  Missing: "Request does not belong to the selected run",
  Conflict: "Request version changed or already has an answer",
  Expired: "Request has expired",
  Permission: "The authenticated client cannot answer at this approval level",
  Corrupt: "Request history has invalid identity, scope, authority or sequence",
  Capacity: "Run request allowance is exhausted",
  Scope: "Approval does not cover the requested operation",
} as const;

export const unknownRequestKind = (kind: string): string => `unknown request kind "${kind}"`;

export const requestAlreadyAnswered = (id: string): string => `request ${id} already has an answer`;

export const RequestTurnMessage = {
  Waiting: "The agent is waiting for request answers",
  Corrupt: "The request turn does not match its durable requests",
  Role: "End each turn with result and requests. Complete work with result and an empty requests array. To wait for a decision, set result to null and provide requests with kind, scope and expires_at. A request records a question or permission decision; it does not execute or grant a tool. Continue only with the answers supplied by Titan.",
} as const;
