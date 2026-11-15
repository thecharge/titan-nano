import { resolve } from "node:path";
import { ServerFile } from "@titan/constants";
import { all } from "@titan/core";
import { readBytes } from "@titan/streams";
import { waitUntil } from "@titan/test-framework";
import { withTemporaryDirectory } from "@titan/test-framework/files";
import { ServerClaimProbeSchema } from "@titan/types";
import { exists } from "@titan/workspace";

export async function serverReaderContention(holdMilliseconds: number) {
  return withTemporaryDirectory(async (home) => {
    await using db = new Bun.SQL({ adapter: "sqlite", filename: resolve(home, ServerFile.Lease) });
    await db.unsafe("CREATE TABLE reader_probe (value INTEGER)");
    await db.unsafe("BEGIN");
    await db.unsafe("SELECT * FROM reader_probe");
    const child = Bun.spawn(
      [process.execPath, resolve("testing/fixtures/server-claim.mjs"), home],
      {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 5000,
      },
    );
    const out = readBytes(child.stdout, 8192);
    const err = readBytes(child.stderr, 8192);
    try {
      if (!(await waitUntil(() => exists(resolve(home, "claim-started")))))
        throw new Error("Ownership probe did not reach its claim");
      await Bun.sleep(holdMilliseconds);
      await db.unsafe("ROLLBACK");
      const [stdout, stderr] = await all([() => out, () => err]);
      if ((await child.exited) !== 0 || stderr.length) throw new Error(stderr.toString());
      return ServerClaimProbeSchema.parse(JSON.parse(stdout.toString()));
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  });
}
