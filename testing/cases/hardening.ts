import { negative, positive, rejected } from "@titan/test-factories";
export const writeProgressCases = {
  positive: [
    positive("complete write", [4, 4], [0]),
    positive("short writes retain every byte", [5, 2], [0, 2, 4]),
  ],
  negative: [
    negative("zero progress fails", [4, 0], { code: "durable_write" }),
    negative("negative progress fails", [4, -1], { code: "durable_write" }),
    negative("impossible write count fails", [4, 5], { code: "durable_write" }),
  ],
};
export const clientAvailabilityCases = {
  positive: [
    positive("loopback JSON response", ["ok"], { ready: true }),
    positive("second independent home", ["second"], { ready: true }),
  ],
  negative: [
    negative("missing address", ["missing"], { code: "server_unavailable", exitCode: 4 }),
    negative("oversized discovery is unavailable", ["oversized-address"], {
      code: "server_unavailable",
      exitCode: 4,
    }),
    negative("oversized response is rejected", ["oversized-response"], {
      code: "invalid_response",
      exitCode: 4,
    }),
    negative("empty response cannot pass as JSON", ["empty"], {
      code: "invalid_response",
      exitCode: 4,
    }),
    negative("corrupt address", ["corrupt"], { code: "server_unavailable", exitCode: 4 }),
    negative("closed listener", ["closed"], { code: "server_unavailable", exitCode: 4 }),
    negative("typed authorization failure", ["unauthorized"], {
      code: "unauthorized",
      exitCode: 4,
    }),
    negative("typed input failure", ["invalid"], { code: "bad_input", exitCode: 2 }),
  ],
};
export const workspaceSafetyCases = {
  positive: [
    positive("ordinary file", ["ordinary"], true),
    positive("nested file", ["nested"], true),
  ],
  negative: [
    negative("symbolic root", ["root-link"], { code: "unsafe_symlink" }),
    negative("symbolic parent", ["parent-link"], { code: "unsafe_symlink" }),
    negative("socket is not a document", ["socket"], { code: "unsupported_file" }),
  ],
};
export const gitOutputCases = {
  positive: [
    positive("normal stdout", ["stdout", 8], 8),
    positive("normal stderr", ["stderr", 8], 0),
  ],
  negative: [
    negative("stdout output limit", ["stdout", 300000], { code: "git_error" }),
    negative("stderr output limit", ["stderr", 300000], { code: "git_error" }),
  ],
};
export const boardAvailabilityCases = {
  positive: [
    positive("safe run path", ["one"], "one"),
    positive("another safe run path", ["two"], "two"),
  ],
  negative: [
    negative("missing board", ["missing"], { code: "run_not_found" }),
    negative("symbolic loop is an IO error", ["loop"], { code: "ELOOP" }),
  ],
};
export const engineInterruptionCases = {
  positive: [
    positive("pause interrupts active session", ["pause"], "paused"),
    positive("cancel interrupts active session", ["cancel"], "cancelled"),
  ],
  negative: [
    rejected("pause drains two active agents", ["parallel-pause"], "paused"),
    rejected("cancel drains two active agents", ["parallel-cancel"], "cancelled"),
    rejected("deadline interrupts active session", ["deadline"], "timed_out"),
    rejected("pause interrupts recovery delay", ["backoff-pause"], "paused"),
    rejected("cancel interrupts recovery delay", ["backoff-cancel"], "cancelled"),
  ],
};
export const serverProtocolCases = {
  positive: [
    positive("health endpoint", ["health"], 200),
    positive("existing engine rejects another writer", ["lock"], "server_locked"),
    positive("run reloads from journal", ["reload"], 200),
  ],
  negative: [
    rejected("unknown route", ["route"], 404),
    rejected("unknown run", ["missing"], 400),
    rejected("unsupported method", ["method"], 400),
    rejected("pending index row remains visible", ["incomplete"], "initialization_incomplete"),
    rejected(
      "failed resume is contained without a successful acknowledgment",
      ["resume-failure"],
      500,
    ),
  ],
};

export const residentRunCases = {
  positive: [
    positive("minimum residency retains the latest run", [1, true, 1], true),
    positive("three resident runs retain their latest run", [1, true, 3], true),
    positive("full resident set remains queryable", [0, true], true),
    positive("latest run survives eviction", [1, true], true),
  ],
  negative: [
    negative("zero engine residency is refused before I/O", [0, true, 0], { name: "ZodError" }),
    negative("negative engine residency is refused before I/O", [0, true, -1], {
      name: "ZodError",
    }),
    rejected("minimum residency evicts its oldest inactive run", [1, false, 1], false),
    rejected("three-run residency evicts its oldest inactive run", [1, false, 3], false),
    rejected("oldest inactive run is evicted", [1, false], false),
    rejected("repeated admissions do not retain evicted runs", [2, false], false),
  ],
};
