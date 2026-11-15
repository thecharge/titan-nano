import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TitanError } from "@titan/errors";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  assertBuiltFeatures,
  assertStatementPaths,
  personaAction,
  resolvedPersona,
  validateWorkflow,
} from "@titan/workflow";

export function workflowFileCheck(workflow: unknown) {
  try {
    const plan = validateWorkflow(workflow);
    assertBuiltFeatures(plan);
    return { ok: true, nodes: plan.nodes.length };
  } catch (error) {
    if (error instanceof TitanError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export function workflowFileShape(workflow: unknown, platform?: string) {
  try {
    return { ok: true, nodes: validateWorkflow(workflow, undefined, platform).nodes.length };
  } catch (error) {
    if (error instanceof TitanError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export function personaHelpers(workflow: unknown, name: string) {
  const plan = validateWorkflow(workflow);
  const action = plan.nodes[0]?.do;
  try {
    return {
      ok: true,
      role: resolvedPersona(plan.workflow, name).role,
      worker: action ? personaAction(action)?.persona : undefined,
    };
  } catch (error) {
    if (error instanceof TitanError) return { ok: false, code: error.code, message: error.message };
    throw error;
  }
}

export async function statementCheck(
  path: string | null,
  link: string | null,
  solution?: string,
  loop = false,
) {
  return withTemporaryDirectory((project) =>
    withTemporaryDirectory(async (outside) => {
      await mkdir(join(project, "proofs"));
      await writeFile(join(project, "proofs/sum.lean"), "theorem sum : True := trivial");
      await writeFile(join(outside, "secret.lean"), "theorem secret : True := trivial");
      if (link)
        await symlink(
          loop ? join(project, link) : join(outside, "secret.lean"),
          join(project, link),
        );
      const plan = validateWorkflow({
        name: "File",
        goal: "Prove",
        personas: {
          fixer: { description: "Fix", role: "Fix" },
          reviewer: { description: "R", role: "R" },
        },
        steps: [
          {
            id: "one",
            do: { persona: "fixer", task: "Fix" },
            falsify: [{ persona: "reviewer", task: "Refute" }],
            verify: [
              path === null
                ? { kind: "script", run: "bun test", deterministic: true }
                : {
                    kind: "lean",
                    statement: path,
                    theorems: ["sum"],
                    ...(solution ? { solution } : {}),
                  },
            ],
          },
        ],
      });
      try {
        await assertStatementPaths(plan, project);
        return { ok: true };
      } catch (error) {
        if (error instanceof TitanError) return { ok: false, code: error.code };
        throw error;
      }
    }),
  );
}
