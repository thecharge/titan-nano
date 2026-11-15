import { createLogger } from "../../packages/logger/src/index.ts";

const failingSink =
  process.argv[4] === "true" ? async (bytes) => Bun.write(import.meta.dir, bytes) : undefined;
const logger = await createLogger(JSON.parse(process.argv[3]), failingSink);
const accepted = await logger.write(JSON.parse(process.argv[2]));
console.log(JSON.stringify({ accepted, statistics: await logger.statistics() }));
