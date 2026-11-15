import { resolve } from "node:path";
import { Development, HookFile, OwnedSource, SourceCommentLimit } from "@titan/constants";
import { sourceCommentReadLimit, sourceCommentViolation } from "@titan/messages";
import { type SourceCommentLimits, SourceCommentLimitsSchema } from "@titan/types";
import ts from "typescript";
import { ownedSources } from "./owned-sources.ts";

function commentLines(source: ts.SourceFile, position: number, lines: Set<number>): void {
  const ranges = [
    ...(ts.getLeadingCommentRanges(source.text, position) ?? []),
    ...(ts.getTrailingCommentRanges(source.text, position) ?? []),
  ];
  for (const range of ranges) {
    lines.add(source.getLineAndCharacterOfPosition(range.pos).line + 1);
    if (lines.size > SourceCommentLimit.Findings) throw new Error(sourceCommentReadLimit);
  }
}

function inspectNode(node: ts.Node, source: ts.SourceFile, lines: Set<number>): void {
  const children = node.getChildren(source);
  if (!children.length && !ts.isJsxText(node)) commentLines(source, node.pos, lines);
  for (const child of children) inspectNode(child, source, lines);
}

export function inspectSourceComments(
  text: string,
  file: string = Development.SourceFile,
): number[] {
  if (Buffer.byteLength(text) > OwnedSource.MaximumSourceBytes)
    throw new Error(sourceCommentReadLimit);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lines = new Set<number>();
  inspectNode(source, source, lines);
  return [...lines].sort((left, right) => left - right);
}

export async function sourceCommentFindings(
  root: string,
  limits: SourceCommentLimits,
): Promise<string[]> {
  const findings: string[] = [];
  let files = 0;
  let bytes = 0;
  for await (const [file, text] of ownedSources(root)) {
    files++;
    bytes += Buffer.byteLength(text);
    if (files > limits.max_files || bytes > limits.total_bytes)
      throw new Error(sourceCommentReadLimit);
    const lines = inspectSourceComments(text, file);
    if (findings.length + lines.length > limits.max_findings)
      throw new Error(sourceCommentReadLimit);
    findings.push(...lines.map((line) => sourceCommentViolation(file, line)));
  }
  if (!files) throw new Error(sourceCommentReadLimit);
  return findings;
}

export async function checkSourceComments(
  root = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report = console.error,
  input: unknown = {},
): Promise<number> {
  const findings = await sourceCommentFindings(root, SourceCommentLimitsSchema.parse(input));
  for (const finding of findings) report(finding);
  return findings.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = await checkSourceComments();
