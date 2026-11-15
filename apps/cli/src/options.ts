import { parseArgs } from "node:util";
import { CliOptionDefinitions } from "@titan/constants";

export function parseRaw(args: string[]) {
  return parseArgs({ args, allowPositionals: true, strict: true, options: CliOptionDefinitions });
}
