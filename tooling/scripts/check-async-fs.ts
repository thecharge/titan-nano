import { resolve } from "node:path";
import { AsyncFileSystemRule, Development, HookFile } from "@titan/constants";
import { asyncFileSystemViolation } from "@titan/messages";
import ts from "typescript";
import { ownedSources } from "./owned-sources.ts";

function fileSystemModule(node: ts.Node | undefined): boolean {
  return Boolean(
    node &&
      ts.isStringLiteralLike(node) &&
      AsyncFileSystemRule.Modules.some((name) => name === node.text),
  );
}

function moduleLoader(target: ts.Expression): boolean {
  while (
    ts.isParenthesizedExpression(target) ||
    ts.isAsExpression(target) ||
    ts.isTypeAssertionExpression(target) ||
    ts.isNonNullExpression(target) ||
    ts.isSatisfiesExpression(target)
  )
    target = target.expression;
  const member = ts.isPropertyAccessExpression(target)
    ? target.name
    : ts.isElementAccessExpression(target)
      ? target.argumentExpression
      : target;
  return (
    target.kind === ts.SyntaxKind.ImportKeyword ||
    ((ts.isIdentifier(member) || ts.isStringLiteralLike(member)) &&
      AsyncFileSystemRule.Loaders.some((name) => name === member.text))
  );
}

export function inspectAsyncFileSystem(text: string): number[] {
  const source = ts.createSourceFile(Development.SourceFile, text, ts.ScriptTarget.Latest, true);
  const findings: number[] = [];
  const visit = (node: ts.Node): void => {
    let invalid = false;
    if (ts.isImportDeclaration(node) && fileSystemModule(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      invalid = Boolean(
        clause?.name ||
          (bindings &&
            (!ts.isNamedImports(bindings) ||
              bindings.elements.some((item) =>
                (item.propertyName ?? item.name).text.endsWith(
                  AsyncFileSystemRule.SynchronousSuffix,
                ),
              ))),
      );
    }
    if (ts.isExportDeclaration(node) && fileSystemModule(node.moduleSpecifier)) {
      const clause = node.exportClause;
      invalid =
        !clause ||
        !ts.isNamedExports(clause) ||
        clause.elements.some((item) =>
          (item.propertyName ?? item.name).text.endsWith(AsyncFileSystemRule.SynchronousSuffix),
        );
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      invalid = fileSystemModule(node.moduleReference.expression);
    if (ts.isCallExpression(node) && fileSystemModule(node.arguments[0])) {
      invalid = moduleLoader(node.expression);
    }
    if (invalid)
      findings.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

export async function checkAsyncFileSystem(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report = console.error,
): Promise<number> {
  let failures = 0;
  for await (const [file, text] of ownedSources(root)) {
    for (const line of inspectAsyncFileSystem(text)) {
      report(asyncFileSystemViolation(file, line));
      failures++;
    }
  }
  return failures ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkAsyncFileSystem();
