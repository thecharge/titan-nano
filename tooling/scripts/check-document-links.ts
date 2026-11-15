import { opendir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  DocumentLinkPolicy,
  FileEncoding,
  HookFile,
  PackageReadme,
  PathPart,
  TextSymbol,
} from "@titan/constants";
import { DocumentLinkMessage } from "@titan/messages";
import { readFileBytes } from "@titan/streams";
import {
  type DocumentLinkLimits,
  DocumentLinkLimitsSchema,
  type DocumentLinkTarget,
  type DocumentReadState,
  type HookReporter,
} from "@titan/types";
import { documentLinkProblems } from "./document-links.ts";

async function* ownedDocuments(
  root: string,
  state: DocumentReadState,
  limits: DocumentLinkLimits,
  parent: string = TextSymbol.Empty,
  depth = 0,
): AsyncGenerator<string> {
  const directory = await opendir(resolve(root, parent));
  for await (const entry of directory) {
    if (++state.entries > limits.entries) throw new Error(DocumentLinkMessage.Budget);
    if (DocumentLinkPolicy.Excluded.some((part) => part === entry.name)) continue;
    const markdown = DocumentLinkPolicy.Extensions.some((extension) =>
      entry.name.endsWith(extension),
    );
    if (!parent && !markdown && !DocumentLinkPolicy.Roots.some((name) => name === entry.name))
      continue;
    if (entry.isSymbolicLink()) throw new Error(DocumentLinkMessage.Failed);
    const path = join(parent, entry.name);
    if (entry.isDirectory() && depth >= limits.depth) throw new Error(DocumentLinkMessage.Budget);
    if (entry.isDirectory()) yield* ownedDocuments(root, state, limits, path, depth + 1);
    else if (markdown) yield path;
  }
}

async function readDocumentTarget(
  root: string,
  path: string,
  state: DocumentReadState,
  limits: DocumentLinkLimits,
): Promise<DocumentLinkTarget> {
  if (++state.reads > limits.reads) throw new Error(DocumentLinkMessage.Budget);
  const canonical = await realpath(resolve(root, path)).catch(() => null);
  if (canonical === null) return { exists: false };
  const contained = relative(root, canonical);
  if (
    isAbsolute(contained) ||
    contained === PathPart.Parent ||
    contained.startsWith(PathPart.ParentPrefix)
  )
    return { exists: false };
  const info = await stat(canonical);
  if (info.isDirectory()) return { exists: true };
  if (!info.isFile()) return { exists: false };
  if (!DocumentLinkPolicy.Extensions.some((extension) => canonical.endsWith(extension)))
    return { exists: true };
  const bytes = await readFileBytes(
    canonical,
    Math.min(limits.file_bytes, limits.total_bytes - state.bytes),
  );
  state.bytes += bytes.byteLength;
  return {
    exists: true,
    markdown: new TextDecoder(FileEncoding.Utf8, { fatal: true }).decode(bytes),
  };
}

async function documentLinkFindings(root: string, limits: DocumentLinkLimits): Promise<string[]> {
  const state = { entries: 0, reads: 0, bytes: 0 };
  const load = (path: string) => readDocumentTarget(root, path, state, limits);
  const main = await load(PackageReadme.File);
  if (main.markdown === undefined) throw new Error(DocumentLinkMessage.Failed);
  const findings: string[] = [];
  for await (const file of ownedDocuments(root, state, limits)) {
    const loaded = file === PackageReadme.File ? main : await load(file);
    if (loaded.markdown === undefined) throw new Error(DocumentLinkMessage.Failed);
    const next = await documentLinkProblems(file, loaded.markdown, load, limits);
    if (findings.length + next.length > limits.findings)
      throw new Error(DocumentLinkMessage.Budget);
    findings.push(...next);
  }
  return findings;
}

export async function checkDocumentLinks(
  directory = resolve(import.meta.dir, HookFile.RepositoryRoot),
  report: HookReporter = console.log,
  input: unknown = {},
): Promise<number> {
  try {
    const limits = DocumentLinkLimitsSchema.parse(input);
    const findings = await documentLinkFindings(await realpath(directory), limits);
    findings.forEach(report);
    if (!findings.length) report(DocumentLinkMessage.Passed);
    return findings.length ? 1 : 0;
  } catch (error) {
    report(
      error instanceof Error && error.message === DocumentLinkMessage.Budget
        ? DocumentLinkMessage.Budget
        : DocumentLinkMessage.Failed,
    );
    return 1;
  }
}

if (import.meta.main) process.exitCode = await checkDocumentLinks();
