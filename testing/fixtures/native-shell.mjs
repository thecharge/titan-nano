import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const cli = fileURLToPath(
  new URL("./cli.js", import.meta.resolve("@anthropic-ai/sandbox-runtime")),
);
assert.equal(typeof command, "string");
assert.ok(command.startsWith(`'${process.execPath}' '${cli}' '--settings' `));
assert.ok(Buffer.byteLength(command) < 1024 * 1024);
const child = Bun.spawn(["/bin/sh", "-c", command], { stdout: "pipe", stderr: "pipe" });
const output = await new Response(child.stdout).text();
const error = await new Response(child.stderr).text();
console.log(JSON.stringify({ exit: await child.exited, output, error }));
