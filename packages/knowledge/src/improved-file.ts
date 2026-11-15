import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ImprovedFile } from "@titan/constants";

export function improvedFileName(name: string, version: number): string {
  return `${name}${ImprovedFile.VersionMark}${version}${ImprovedFile.Extension}`;
}

export async function nextImprovedVersion(directory: string, name: string): Promise<number> {
  const prefix = `${name}${ImprovedFile.VersionMark}`;
  const found = (await readdir(directory))
    .filter((entry) => entry.startsWith(prefix) && entry.endsWith(ImprovedFile.Extension))
    .map((entry) => entry.slice(prefix.length, entry.length - ImprovedFile.Extension.length))
    .filter((middle) => ImprovedFile.Digits.test(middle))
    .map(Number);
  return Math.max(ImprovedFile.FirstSaved - 1, ...found) + 1;
}

export async function saveImprovedFile(
  directory: string,
  name: string,
  content: string,
): Promise<string> {
  const version = await nextImprovedVersion(directory, name);
  const path = resolve(directory, improvedFileName(name, version));
  await writeFile(path, content, { encoding: ImprovedFile.Utf8, flag: ImprovedFile.ExclusiveFlag });
  return path;
}
