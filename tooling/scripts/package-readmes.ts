import { join } from "node:path";
import {
  BoundaryReadLimit,
  FileEncoding,
  Newline,
  PackageReadme,
  ReadmeFinding,
  TextSymbol,
} from "@titan/constants";
import { exists } from "@titan/workspace";

import { readInventoryBytes } from "./inventory-bytes.ts";

export async function inspectReadme(name: string, text: string): Promise<ReadmeFinding[]> {
  const findings: ReadmeFinding[] = [];
  if (!text.startsWith(PackageReadme.Title + name + Newline)) findings.push(ReadmeFinding.Title);
  for (const section of PackageReadme.Sections) {
    const offset = text.indexOf(section + Newline);
    if (offset < 0) {
      findings.push(ReadmeFinding.Sections);
      continue;
    }
    const body = text.slice(offset + section.length).trimStart();
    if (!body || PackageReadme.HeadingPattern.test(body)) findings.push(ReadmeFinding.EmptySection);
  }
  return findings;
}

export async function checkPackageReadme(
  root: string,
  directory: string,
  name: string,
): Promise<ReadmeFinding[]> {
  if (directory === TextSymbol.Dot) return [];
  const file = join(root, directory, PackageReadme.File);
  if (!(await exists(file))) return [ReadmeFinding.Missing];
  return inspectReadme(
    name,
    (await readInventoryBytes(file, BoundaryReadLimit.ManifestBytes)).toString(FileEncoding.Utf8),
  );
}
