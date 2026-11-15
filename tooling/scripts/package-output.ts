import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { VerificationMessage } from "@titan/messages";
import { captureCommand } from "@titan/process";
import { type PackageOutputOptions, PackageOutputOptionsSchema } from "@titan/types";

export async function packageOutput(
  command: readonly string[],
  cwd: string,
  options: PackageOutputOptions = {},
): Promise<Buffer> {
  const limits = PackageOutputOptionsSchema.parse(options);
  try {
    const result = await captureCommand(command, cwd, limits);
    if (result.exit_code !== 0) throw new Error(VerificationMessage.PackageOutputFailed);
    return result.stdout;
  } catch (error) {
    if (error instanceof TitanError && error.code === ErrorCode.CommandTimeout)
      throw new Error(VerificationMessage.PackageOutputTimeout);
    throw error;
  }
}
