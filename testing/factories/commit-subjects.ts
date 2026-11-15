import { resolve } from "node:path";
import { all } from "@titan/core";

const script = resolve(import.meta.dir, "../../tooling/scripts/check-commits.ts");

export async function commitSubjectCheck(subject: string) {
  const child = Bun.spawn([process.execPath, script, subject], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await all([
    () => new Response(child.stdout).text(),
    () => new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  return { code, failed: (out + err).includes(`FAIL ${subject}`) };
}
