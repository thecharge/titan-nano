import { Backend, ErrorCode, RunStatus } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const resumed = (selected: Backend, requested = selected) => ({
  state: RunStatus.Passed,
  backends: [selected, selected, selected, requested, requested],
  error: null,
});
const refused = (selected: Backend) => ({
  state: RunStatus.Paused,
  backends: [selected, selected, selected],
  error: ErrorCode.Backend,
});
const delayed = (selected: Backend) => ({
  state: RunStatus.Paused,
  backends: [selected, selected, selected],
  error: null,
});

export const backendAuthorizationCases = {
  positive: [
    positive(
      "Claude retry preserves selection and its completed peer after server restart",
      [Backend.Claude, false, null],
      resumed(Backend.Claude),
    ),
    positive(
      "Codex retry preserves selection and its completed peer after server restart",
      [Backend.Codex, false, null],
      resumed(Backend.Codex),
    ),
    positive(
      "an explicit owner switch to Codex survives a Claude limit and restart",
      [Backend.Claude, true, Backend.Codex],
      resumed(Backend.Claude, Backend.Codex),
    ),
    positive(
      "an explicit owner switch to Claude survives a Codex limit and restart",
      [Backend.Codex, true, Backend.Claude],
      resumed(Backend.Codex, Backend.Claude),
    ),
  ],
  negative: [
    rejected(
      "a Claude limit cannot silently dispatch Codex before or after restart",
      [Backend.Claude, true, null],
      delayed(Backend.Claude),
    ),
    rejected(
      "a Codex limit cannot silently dispatch Claude before or after restart",
      [Backend.Codex, true, null],
      delayed(Backend.Codex),
    ),
    rejected(
      "an unknown backend is refused before resuming a Claude run",
      [Backend.Claude, false, "unapproved"],
      refused(Backend.Claude),
    ),
    rejected(
      "an empty backend is refused before resuming a Codex run",
      [Backend.Codex, true, ""],
      refused(Backend.Codex),
    ),
  ],
};
