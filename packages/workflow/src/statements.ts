import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { ErrorCode, ErrorField, FileErrorCode, PathPart, VerifyField } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unsafeStatement } from "@titan/messages";
import type { Plan, VerifyEntry } from "@titan/types";

function statementPaths(entries: VerifyEntry[]): string[] {
  return entries.flatMap((entry) => {
    if (VerifyField.Statement in entry)
      return VerifyField.Solution in entry && entry.solution
        ? [entry.statement, entry.solution]
        : [entry.statement];
    return [];
  });
}

function inside(root: string, path: string): boolean {
  const from = relative(root, path);
  return !from.startsWith(PathPart.Parent) && !isAbsolute(from);
}

async function resolved(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return path;
    throw error;
  }
}

export async function assertStatementPaths(plan: Plan, project: string): Promise<void> {
  const root = await resolved(project);
  const entries = [...(plan.workflow.verify ?? []), ...plan.nodes.flatMap((step) => step.verify)];
  for (const path of statementPaths(entries)) {
    const target = resolve(project, path);
    if (!inside(resolve(project), target))
      throw new TitanError(ErrorCode.UnsafePath, unsafeStatement(path));
    if (!inside(root, await resolved(target)))
      throw new TitanError(ErrorCode.UnsafeSymlink, unsafeStatement(path));
  }
}
