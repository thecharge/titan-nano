import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { ErrorCode } from "@titan/constants";
import { OperationalError } from "@titan/errors";
import { executableUnavailable } from "@titan/messages";

export async function requireProgram(path: string, executable: boolean): Promise<void> {
  try {
    if (!(await stat(path)).isFile())
      throw new OperationalError(ErrorCode.BackendExecutable, executableUnavailable(path));
    await access(path, constants.R_OK | (executable ? constants.X_OK : 0));
  } catch {
    throw new OperationalError(ErrorCode.BackendExecutable, executableUnavailable(path));
  }
}
