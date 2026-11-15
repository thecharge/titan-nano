import { expect, test } from "bun:test";
import { access, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import {
  createWorkspace,
  exists,
  git,
  readTree,
  safeDestination,
  writeTree,
} from "@titan/workspace";

test("Git workspaces receive candidate files without changing the original checkout", async () => {
  await withTemporaryDirectory(async (root) => {
    const project = resolve(root, "project");
    const source = resolve(root, "source");
    const work = resolve(root, "candidate");
    const init = Bun.spawn(["git", "init", project], { stdout: "ignore", stderr: "ignore" });
    expect(await init.exited).toBe(0);
    await writeFile(resolve(project, "note.txt"), Buffer.from("original"));
    await git(project, ["add", "note.txt"]);
    await git(project, [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-m",
      "test: base",
    ]);
    await mkdir(source);
    await writeFile(resolve(source, "note.txt"), Buffer.from("candidate"));
    await createWorkspace(project, work, await readTree(source));
    expect(await exists(resolve(work, ".git"))).toBe(true);
    expect(await readFile(resolve(work, "note.txt"), "utf8")).toBe("candidate");
    expect(await readFile(resolve(project, "note.txt"), "utf8")).toBe("original");
    await writeTree(work, {});
    await expect(access(resolve(work, "note.txt"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(safeDestination(work, "nested/file.txt")).toBe(resolve(work, "nested/file.txt"));
    expect(() => safeDestination(work, "../escape")).toThrow("Unsafe");
    await expect(git(project, ["not-a-git-command"])).rejects.toThrow();
    await symlink("/etc/passwd", resolve(work, "escape"));
    await expect(readTree(work)).rejects.toThrow("symlink");
  });
});
