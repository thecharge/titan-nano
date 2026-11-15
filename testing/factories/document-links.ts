import { strict as assert } from "node:assert";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { IoLimit } from "@titan/constants";
import { readFileBytes } from "@titan/streams";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import type { DocumentLinkTarget } from "@titan/types";
import { checkDocumentLinks } from "../../tooling/scripts/check-document-links.ts";
import { documentLinkProblems } from "../../tooling/scripts/document-links.ts";
import { commandOutput } from "../../tooling/scripts/hook-process.ts";
import { outgoingCommits } from "../../tooling/scripts/hook-revisions.ts";
import { withGitSnapshot } from "../../tooling/scripts/hook-snapshot.ts";

export async function documentLinks(
  content: string,
  targets: Record<string, DocumentLinkTarget> = {},
  limits: unknown = {},
  failed = false,
) {
  const reads: string[] = [];
  const findings = await documentLinkProblems(
    "docs/guide.md",
    content,
    async (path) => {
      reads.push(path);
      if (failed) throw new Error("Controlled document read failure");
      return targets[path] ?? { exists: false };
    },
    limits,
  );
  return { findings, reads };
}

export function documentLinkTree(
  files: Record<string, string>,
  limits: unknown = {},
  missing = false,
) {
  return withTemporaryDirectory(async (root) => {
    for (const [file, text] of Object.entries(files)) {
      await mkdir(dirname(resolve(root, file)), { recursive: true });
      await writeFile(resolve(root, file), Buffer.from(text));
    }
    const findings: string[] = [];
    const code = await checkDocumentLinks(
      missing ? resolve(root, "absent") : root,
      (finding) => findings.push(finding),
      limits,
    );
    await unchangedDocuments(root, files);
    return { code, findings };
  });
}

async function unchangedDocuments(root: string, files: Record<string, string>): Promise<void> {
  for (const [file, text] of Object.entries(files))
    assert.deepEqual(
      await readFileBytes(resolve(root, file), IoLimit.DataBytes),
      Buffer.from(text),
    );
}

export function documentLinkResolvedTarget(outside: boolean, directory: boolean) {
  return withTemporaryDirectory(async (temporary) => {
    const root = resolve(temporary, "repository");
    const assets = resolve(root, "assets");
    const target = resolve(outside ? temporary : assets, directory ? "target" : "target.md");
    await mkdir(assets, { recursive: true });
    if (directory) await mkdir(target);
    else await writeFile(target, Buffer.from("## Target\n"));
    await symlink(target, resolve(assets, "link"));
    const source = Buffer.from(
      directory ? "[asset](assets/link)\n" : "[asset](assets/link#target)\n",
    );
    await writeFile(resolve(root, "README.md"), source);
    const code = await checkDocumentLinks(root, () => {});
    assert.deepEqual(await readFile(resolve(root, "README.md")), source);
    return code;
  });
}

export function documentLinkSourceLink(linked: boolean, outside: boolean) {
  return withTemporaryDirectory(async (temporary) => {
    const root = resolve(temporary, "repository");
    await mkdir(root);
    const target = resolve(outside ? temporary : root, "target.md");
    await writeFile(target, Buffer.from("# Guide\n"));
    const source = resolve(root, "README.md");
    if (linked) await symlink(target, source);
    else await writeFile(source, Buffer.from("# Guide\n"));
    return checkDocumentLinks(root, () => {});
  });
}

export function documentLinkEncoding(malformed: boolean, secondary: boolean) {
  return withTemporaryDirectory(async (root) => {
    await mkdir(resolve(root, "docs"));
    const bytes = malformed ? Buffer.from([255]) : Buffer.from("# Guide\n");
    const file = resolve(root, secondary ? "docs/guide.md" : "README.md");
    await writeFile(resolve(root, "README.md"), Buffer.from("# Guide\n"));
    await writeFile(file, bytes);
    const code = await checkDocumentLinks(root, () => {});
    assert.deepEqual(await readFile(file), bytes);
    return code;
  });
}

async function documentRevision(root: string, parent?: string): Promise<string> {
  const git = (...arguments_: string[]) => commandOutput(["git", ...arguments_], { cwd: root });
  await git("add", "README.md");
  const tree = await git("write-tree");
  return git(
    "-c",
    "user.name=Titan Fixture",
    "-c",
    "user.email=titan@example.invalid",
    "commit-tree",
    tree,
    "-m",
    "docs: document fixture",
    ...(parent ? ["-p", parent] : []),
  );
}

export function documentLinkSnapshot(valid: boolean, outgoing: boolean) {
  return withTemporaryDirectory(async (root) => {
    const git = (...arguments_: string[]) => commandOutput(["git", ...arguments_], { cwd: root });
    const file = resolve(root, "README.md");
    await git("init", "--initial-branch=main");
    await writeFile(file, Buffer.from("# Guide\n"));
    const base = await documentRevision(root);
    await writeFile(file, Buffer.from(valid ? "# Guide\n" : "[missing](missing.md)"));
    const first = await documentRevision(root, base);
    const staged = await git("write-tree");
    await writeFile(file, Buffer.from(valid ? "[missing](missing.md)" : "# Guide\n"));
    const before = await readFile(file);
    const code = await withGitSnapshot(root, staged, (snapshot) =>
      checkDocumentLinks(snapshot, () => {}),
    );
    if (!outgoing) {
      assert.equal(await git("write-tree"), staged);
      assert.deepEqual(await readFile(file), before);
      return [code];
    }
    const last = await documentRevision(root, first);
    const revisions = await outgoingCommits(root, {
      localRef: "refs/heads/main",
      localObject: last,
      remoteRef: "refs/heads/main",
      remoteObject: base,
    });
    assert.deepEqual(revisions, [first, last]);
    const codes: number[] = [];
    for (const revision of revisions)
      codes.push(
        await withGitSnapshot(root, revision, (snapshot) => checkDocumentLinks(snapshot, () => {})),
      );
    assert.deepEqual(await readFile(file), before);
    return codes;
  });
}
