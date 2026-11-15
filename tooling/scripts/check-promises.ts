import { resolve } from "node:path";
import { Development, HookFile, PromiseRule } from "@titan/constants";
import { promiseViolation } from "@titan/messages";
import ts from "typescript";
import { ownedSources } from "./owned-sources.ts";

export function inspectPromises(text: string): number[] {
  const source = ts.createSourceFile(Development.SourceFile, text, ts.ScriptTarget.Latest, true);
  const findings: number[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === PromiseRule.Object
    ) {
      const member = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
      const name =
        ts.isIdentifier(member) || ts.isStringLiteralLike(member) ? member.text : undefined;
      if (PromiseRule.Methods.some((method) => method === name))
        findings.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export async function promiseFindings(root: string): Promise<string[]> {
  const findings: string[] = [];
  for await (const [file, text] of ownedSources(root))
    findings.push(...inspectPromises(text).map((line) => promiseViolation(file, line)));
  return findings;
}

export async function checkPromises(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report = console.error,
): Promise<number> {
  const findings = await promiseFindings(root);
  for (const finding of findings) report(finding);
  return findings.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkPromises();
