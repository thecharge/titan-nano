import {
  boundaryFinding,
  boundarySummary,
  packageCheckFailure,
  packageCommandFailure,
  pendingScenarios,
  serverExited,
  stepReference,
} from "@titan/messages";
export function diagnostic(kind: string) {
  if (kind === "summary") return boundarySummary(2, 0);
  if (kind === "pending") return pendingScenarios(3);
  if (kind === "boundary")
    return boundaryFinding(
      "@titan/core",
      "src/index.ts",
      "private-export",
      "@titan/runner/internal",
    );
  if (kind === "package") return packageCheckFailure(["bun", "run", "pack:preview"]);
  if (kind === "command") return packageCommandFailure(["titan", "check"], "invalid workflow");
  if (kind === "exit") return serverExited("unavailable");
  return stepReference("consumer", "producer.note");
}
