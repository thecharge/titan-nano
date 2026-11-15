export const CliOutputMessage = {
  FollowJson: "Event following cannot use --json; use --follow --format jsonl",
  Format: "Event --format accepts jsonl only with --follow",
  Blocked: "Run is blocked. Resolve its missing prerequisite, then resume the same run.",
} as const;
export const limitTimeLeft = (minutes: number): string =>
  `Usage limit: about ${minutes} minute(s) left before the reset; the run continues then`;
