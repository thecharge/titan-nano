import { resolve } from "node:path";
import { FlatTestRule, HookFile, TestLayout } from "@titan/constants";
import {
  flatTestReadLimit,
  flatTestViolation,
  invalidTestSource,
  testLayoutViolation,
} from "@titan/messages";
import { type FlatTestReadLimits, FlatTestReadLimitsSchema } from "@titan/types";
import ts from "typescript";
import { ownedSources } from "./owned-sources.ts";

async function controlFlow(node: ts.Node): Promise<boolean> {
  return (
    ts.isIfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
  );
}

async function children(node: ts.Node): Promise<ts.Node[]> {
  const found: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    found.push(child);
  });
  return found;
}

async function inspectNode(node: ts.Node, source: ts.SourceFile, lines: number[]): Promise<void> {
  if (await controlFlow(node))
    lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
  for (const child of await children(node)) await inspectNode(child, source, lines);
}

export async function inspectFlatTests(text: string, file: string): Promise<number[]> {
  const parsed = ts.transpileModule(text, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext },
  });
  if (parsed.diagnostics?.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error))
    throw new Error(invalidTestSource(file));
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lines: number[] = [];
  await inspectNode(source, source, lines);
  return lines;
}

export async function flatTestFindings(
  root: string,
  limits: FlatTestReadLimits,
): Promise<string[]> {
  const findings: string[] = [];
  let files = 0;
  let bytes = 0;
  for await (const [file, text] of ownedSources(root)) {
    const test = FlatTestRule.File.test(file);
    const misplacedHelper = TestLayout.ProductHelpers.test(file);
    if (!test && !misplacedHelper) continue;
    files++;
    bytes += Buffer.byteLength(text);
    if (files > limits.max_files || bytes > limits.total_bytes) throw new Error(flatTestReadLimit);
    if (
      misplacedHelper ||
      (test && !TestLayout.TierPrefixes.some((prefix) => file.startsWith(prefix)))
    )
      findings.push(testLayoutViolation(file));
    if (!test) continue;
    for (const line of await inspectFlatTests(text, file))
      findings.push(flatTestViolation(file, line));
  }
  if (!files) throw new Error(flatTestReadLimit);
  return findings;
}

export async function checkFlatTests(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report = console.error,
  input: unknown = {},
): Promise<number> {
  const findings = await flatTestFindings(root, FlatTestReadLimitsSchema.parse(input));
  for (const finding of findings) report(finding);
  return findings.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkFlatTests();
