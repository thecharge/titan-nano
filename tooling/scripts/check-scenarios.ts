import { Development, Newline, ProcessIo } from "@titan/constants";
import { pendingScenarios } from "@titan/messages";

const child = Bun.spawn([Development.Python, Development.IsolatedPython, Development.SpecCheck], {
  stdout: ProcessIo.Inherit,
  stderr: ProcessIo.Inherit,
});
const code = await child.exited;
if (code !== 0) process.exit(code);
const map =
  (await Bun.file(Development.AcceptanceMap).text()) +
  Newline +
  (await Bun.file(Development.RepairAcceptanceMap).text());
const pending = map
  .split(Newline)
  .filter((line) => line.endsWith(Development.PendingSuffix)).length;
console.log(pendingScenarios(pending));
if (process.argv.includes(Development.ReleaseFlag) && pending) process.exit(1);
