import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const file = resolve(process.argv[2] ?? "");
const expected = Buffer.from("#!/bin/sh\nprintf delivered");
if (!file.startsWith(join(tmpdir(), "titan-test-")) || !file.endsWith(`${sep}target${sep}script`))
  throw new Error("Unexpected snapshot execution path");
const metadata = await stat(file);
if (!metadata.isFile() || metadata.size !== expected.length || (metadata.mode & 0o7777) !== 0o700)
  throw new Error("Unexpected snapshot execution metadata");
if (!(await readFile(file)).equals(expected)) throw new Error("Unexpected snapshot script");
const child = Bun.spawn([file], { stdout: "ignore", stderr: "ignore" });
process.exitCode = await child.exited;
