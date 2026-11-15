import { mkdir } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import {
  CoverageFile,
  Development,
  LocalServer,
  OfflineTest,
  ProcessIo,
  TestCoverageArguments,
  TextSymbol,
} from "@titan/constants";
import { all } from "@titan/core";
import { localServerUrl, VerificationMessage } from "@titan/messages";
import { parseCoverage } from "./coverage.ts";
import { formatCoverage, mergeCoverage } from "./coverage-merge.ts";
import { selectOfflineTests } from "./offline-selection.ts";

if (process.env[Development.BoundaryVariable] !== OfflineTest.Runtime)
  throw new Error(VerificationMessage.BoundaryRequired);
if (
  Object.values(networkInterfaces())
    .flat()
    .some((address) => address && !address.internal)
)
  throw new Error(VerificationMessage.ExternalInterface);
const selected = await selectOfflineTests(process.cwd(), process.argv.slice(2));
const local = Bun.serve({
  hostname: LocalServer.Host,
  port: 0,
  fetch: () => new Response(Development.LoopbackResponse),
});
try {
  if (
    (await (await fetch(localServerUrl(local.port ?? 0))).text()) !== Development.LoopbackResponse
  )
    throw new Error(VerificationMessage.MissingLoopback);
  let external = false;
  try {
    await fetch(Development.ExternalProbe, { signal: AbortSignal.timeout(500) });
    external = true;
  } catch {}
  if (external) throw new Error(VerificationMessage.ExternalConnection);
} finally {
  await local.stop(true);
}
const fast = process.env[OfflineTest.FastVariable] === OfflineTest.FastValue;
const shardCount = fast ? Math.max(1, Math.min(OfflineTest.Shards, selected.length)) : 1;
const shards = Array.from({ length: shardCount }, (_, index) =>
  selected.filter((_file, position) => position % shardCount === index),
);
const children = shards.map((files, index) => {
  const directory = OfflineTest.ShardCoverage + index;
  return Bun.spawn(
    [
      process.execPath,
      ...TestCoverageArguments,
      OfflineTest.CoverageDirectoryOption + directory,
      ...files,
    ],
    { stdin: ProcessIo.Ignore, stdout: ProcessIo.Pipe, stderr: ProcessIo.Pipe },
  );
});
const outputs = await all(
  children.map((child) => async () => {
    const [out, err] = await all([
      () => new Response(child.stdout).text(),
      () => new Response(child.stderr).text(),
    ]);
    return { out, err, code: await child.exited };
  }),
  OfflineTest.Shards,
);
for (const output of outputs) {
  await Bun.write(Bun.stdout, output.out);
  await Bun.write(Bun.stderr, output.err);
}
const testCode = outputs.some((output) => output.code !== 0) ? 1 : 0;
const parts = await all(
  shards.map((_files, index) => async () => {
    const file = Bun.file(join(OfflineTest.ShardCoverage + index, OfflineTest.LcovFile));
    return (await file.exists())
      ? parseCoverage((await file.text()).split(TextSymbol.Newline))
      : [];
  }),
  OfflineTest.Shards,
);
await mkdir(dirname(CoverageFile), { recursive: true });
await Bun.write(CoverageFile, formatCoverage(mergeCoverage(parts)));
const coverage = Bun.spawn([process.execPath, Development.CoverageCheck], {
  stdout: ProcessIo.Inherit,
  stderr: ProcessIo.Inherit,
});
const coverageCode = await coverage.exited;
process.exitCode = fast ? testCode : testCode || coverageCode;
