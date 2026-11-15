import { dirname, isAbsolute, join } from "node:path";
import { DocumentLinkPolicy, PathPart, TextSymbol } from "@titan/constants";
import { DocumentLinkMessage, documentLinkInvalid } from "@titan/messages";
import {
  type DocumentLinkLimits,
  DocumentLinkLimitsSchema,
  type DocumentLinkLoader,
} from "@titan/types";
import GithubSlugger from "github-slugger";
import type { Definition, Image, Link, Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString as markdownText } from "mdast-util-to-string";

function documentNodes(text: string, limits: DocumentLinkLimits): Nodes[] {
  if (Buffer.byteLength(text) > limits.file_bytes) throw new Error(DocumentLinkMessage.Budget);
  const pending: Nodes[] = [fromMarkdown(text)];
  const nodes: Nodes[] = [];
  while (pending.length) {
    const node = pending.pop() as Nodes;
    nodes.push(node);
    const children = DocumentLinkPolicy.Children in node ? node.children : [];
    if (nodes.length + pending.length + children.length > limits.nodes)
      throw new Error(DocumentLinkMessage.Budget);
    pending.push(...[...children].reverse());
  }
  return nodes;
}

function documentAnchors(text: string, limits: DocumentLinkLimits): string[] {
  const slugger = new GithubSlugger();
  return documentNodes(text, limits)
    .filter((node) => node.type === DocumentLinkPolicy.Heading)
    .map((node) => slugger.slug(markdownText(node)));
}

function containedPath(path: string): boolean {
  return !isAbsolute(path) && path !== PathPart.Parent && !path.startsWith(PathPart.ParentPrefix);
}

async function validDocumentLink(
  source: string,
  target: string,
  text: string,
  load: DocumentLinkLoader,
  limits: DocumentLinkLimits,
): Promise<boolean> {
  if (DocumentLinkPolicy.Scheme.test(target))
    return DocumentLinkPolicy.AllowedSchemes.some((scheme) =>
      target.toLowerCase().startsWith(scheme),
    );
  if (target.startsWith(PathPart.Separator + PathPart.Separator)) return false;
  const [encoded = TextSymbol.Empty, fragment] = target.split(DocumentLinkPolicy.Fragment);
  const path = decodeURIComponent(encoded.split(DocumentLinkPolicy.Query)[0] ?? TextSymbol.Empty);
  if (path.includes(PathPart.Backslash) || path.includes(DocumentLinkPolicy.NullByte)) return false;
  const file =
    path === TextSymbol.Empty
      ? source
      : path.startsWith(PathPart.Separator)
        ? path.slice(1)
        : join(dirname(source), path);
  if (!containedPath(file)) return false;
  const loaded = file === source ? { exists: true, markdown: text } : await load(file);
  if (!loaded.exists) return false;
  if (fragment === undefined || fragment === TextSymbol.Empty) return true;
  return (
    loaded.markdown !== undefined &&
    documentAnchors(loaded.markdown, limits).includes(decodeURIComponent(fragment))
  );
}

export async function documentLinkProblems(
  source: string,
  content: string,
  load: DocumentLinkLoader,
  input: unknown = {},
): Promise<string[]> {
  const limits = DocumentLinkLimitsSchema.parse(input);
  const targets = documentNodes(content, limits).filter((node) =>
    DocumentLinkPolicy.Targets.some((type) => type === node.type),
  );
  const findings: string[] = [];
  for (const node of targets) {
    const target = (node as Link | Image | Definition).url;
    const valid = await validDocumentLink(source, target, content, load, limits).catch(() => false);
    if (valid) continue;
    if (findings.length >= limits.findings) throw new Error(DocumentLinkMessage.Budget);
    findings.push(
      documentLinkInvalid(source, node.position?.start.line ?? DocumentLinkPolicy.MissingLine),
    );
  }
  return findings;
}
