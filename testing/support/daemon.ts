import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { CliCommand, IoLimit, LocalServer, ProbeOption, ProcessSignal } from "@titan/constants";
import { readAddress } from "@titan/server/client";
import { readFileBytes } from "@titan/streams";
import { processExited, waitUntil } from "@titan/test-framework";
import { exists } from "@titan/workspace";

export async function stopOwnedDaemon(home: string): Promise<void> {
  if (!(await exists(resolve(home, LocalServer.File)))) return;
  const address = await readAddress(home);
  const args = (await readFileBytes(`/proc/${address.pid}/cmdline`, IoLimit.AddressBytes))
    .toString()
    .split("\0");
  assert.ok(args.includes(CliCommand.Serve));
  assert.equal(args[args.indexOf(ProbeOption.Home) + 1], home);
  process.kill(address.pid, ProcessSignal.Kill);
  assert.ok(await waitUntil(() => processExited(address.pid)));
}
