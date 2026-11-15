import { ErrorCode } from "@titan/constants";
import { TitanError } from "@titan/errors";
import { unsafeArtifactPath } from "@titan/messages";
import { WorkspaceRelativePathSchema } from "@titan/types";

export function assertRelative(path: string): string {
  if (!WorkspaceRelativePathSchema.safeParse(path).success)
    throw new TitanError(ErrorCode.UnsafePath, unsafeArtifactPath(path));
  return path;
}
