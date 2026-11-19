import { Newline } from "@titan/constants";

export class StdoutWriteError extends Error {
  constructor(cause: Error) {
    super(cause.message, { cause });
  }
}

export function writeStdoutLine(line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(line + Newline, (error) => {
      if (error) reject(new StdoutWriteError(error));
      else resolve();
    });
  });
}
