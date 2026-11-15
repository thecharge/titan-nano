import { CliArgument, ErrorCode } from "@titan/constants";
import { assertSafeId } from "@titan/core";
import { TitanError } from "@titan/errors";
import { CliDiagnostic, requiredArgument, unknownArgument } from "@titan/messages";
import {
  ArtifactHashSchema,
  CliArgumentsSchema,
  type CommandPositional,
  KnowledgeSelectionSchema,
} from "@titan/types";

export function validatePositionals(
  definitions: readonly CommandPositional[],
  values: readonly string[],
): void {
  if (!CliArgumentsSchema.safeParse(values).success)
    throw new TitanError(ErrorCode.Arguments, CliDiagnostic.ArgumentLimit);
  for (const [index, definition] of definitions.entries()) {
    const value = values[index];
    if (!value && definition.required)
      throw new TitanError(ErrorCode.Arguments, requiredArgument(definition.name));
    if (value && definition.choices && !definition.choices.includes(value))
      throw new TitanError(ErrorCode.Arguments, unknownArgument(definition.name, value));
    if (
      value &&
      (definition.name === CliArgument.RunId || definition.name === CliArgument.RequestId)
    )
      assertSafeId(value);
    if (
      value &&
      definition.name === CliArgument.KnowledgeId &&
      !KnowledgeSelectionSchema.safeParse({ id: value }).success
    )
      throw new TitanError(ErrorCode.Arguments, unknownArgument(definition.name, value));
    if (
      value &&
      definition.name === CliArgument.ArtifactId &&
      !ArtifactHashSchema.safeParse(value).success
    )
      throw new TitanError(ErrorCode.Arguments, unknownArgument(definition.name, value));
  }
}
