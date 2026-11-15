import { writeFile } from "node:fs/promises";
import { ProcessSignal } from "@titan/constants";

const [pid, output, error, code, delay] = process.argv.slice(2);
if (!pid) throw new Error();
await writeFile(pid, Buffer.from(String(process.pid)));
await Bun.stdin.bytes();
await Bun.write(Bun.stdout, Buffer.alloc(Number(output), 197));
await Bun.write(Bun.stderr, Buffer.alloc(Number(error), 131));
process.on(ProcessSignal.Terminate, () => {});
await Bun.sleep(Number(delay));
process.exit(Number(code));
