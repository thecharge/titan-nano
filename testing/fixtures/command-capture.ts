import { writeFile } from "node:fs/promises";
import {
  CommandCaptureFixture,
  CommandCaptureTest,
  ProcessIo,
  ProcessSignal,
} from "@titan/constants";

const [pidFile, mode, descendantFile] = process.argv.slice(2);
if (!pidFile) throw new Error();
await writeFile(pidFile, Buffer.from(String(process.pid)));
await Bun.stdin.bytes();
const output =
  mode === CommandCaptureFixture.Hold
    ? 0
    : mode === CommandCaptureFixture.StdoutOverflow
      ? CommandCaptureTest.Bytes + 1
      : CommandCaptureTest.Bytes;
const error =
  mode === CommandCaptureFixture.Hold
    ? 0
    : mode === CommandCaptureFixture.StderrOverflow
      ? CommandCaptureTest.Bytes + 1
      : CommandCaptureTest.Bytes;
await Bun.write(Bun.stdout, Buffer.alloc(output, CommandCaptureTest.StdoutByte));
await Bun.write(Bun.stderr, Buffer.alloc(error, CommandCaptureTest.StderrByte));
if (mode === CommandCaptureFixture.Signal) process.kill(process.pid, ProcessSignal.Kill);
if (mode === CommandCaptureFixture.Descendant) {
  if (!descendantFile) throw new Error();
  const child = Bun.spawn(
    [process.execPath, import.meta.path, descendantFile, CommandCaptureFixture.Hold],
    { stdin: ProcessIo.Ignore, stdout: ProcessIo.Inherit, stderr: ProcessIo.Inherit },
  );
  await writeFile(descendantFile, Buffer.from(String(child.pid)));
  process.exit(0);
}
if (
  [CommandCaptureFixture.Cancel, CommandCaptureFixture.Timeout, CommandCaptureFixture.Hold].some(
    (candidate) => candidate === mode,
  )
)
  await Bun.sleep(CommandCaptureTest.HeldMilliseconds);
process.exit(mode === CommandCaptureFixture.Nonzero ? CommandCaptureTest.ExitCode : 0);
