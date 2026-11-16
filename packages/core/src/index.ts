import { createHash, randomUUID } from "node:crypto";
import {
  ErrorCode,
  ExitCode,
  FileEncoding,
  HashAlgorithm,
  IdentifierPattern,
  MessageId,
  RunStatus,
  TextSymbol,
  UuidLayout,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { ConfigMessage } from "@titan/messages";
import type { Usage } from "@titan/types";

export const hash = (value: string | Uint8Array): string =>
  createHash(HashAlgorithm.Sha256).update(value).digest(FileEncoding.Hex);
export const newId = (): string => randomUUID();
export function uuidFromText(text: string): string {
  const digits = hash(text);
  const parts = UuidLayout.Groups.map(([start, end]) => digits.slice(start, end));
  const first = parts[0] ?? TextSymbol.Empty;
  const second = parts[1] ?? TextSymbol.Empty;
  const third = parts[2] ?? TextSymbol.Empty;
  const fourth = parts[3] ?? TextSymbol.Empty;
  const fifth = parts[4] ?? TextSymbol.Empty;
  return [first, second, UuidLayout.Version + third, UuidLayout.Variant + fourth, fifth].join(
    UuidLayout.Separator,
  );
}
export function assertSafeId(value: string): string {
  if (!IdentifierPattern.test(value)) {
    throw new TitanError(ErrorCode.InvalidId, ConfigMessage[MessageId.SafeIdentifierRequired]);
  }
  return value;
}
export const emptyUsage = (): Usage => ({
  input_tokens: null,
  output_tokens: null,
  cost_usd: null,
});

export function isActiveRun(state: RunStatus): boolean {
  return (
    state === RunStatus.Running || state === RunStatus.Recovering || state === RunStatus.Pausing
  );
}
export function runExitCode(state: RunStatus): ExitCode {
  if (state === RunStatus.Passed) return ExitCode.Success;
  if (state === RunStatus.Failed || state === RunStatus.Cancelled || state === RunStatus.TimedOut)
    return ExitCode.Unsuccessful;
  return ExitCode.Blocked;
}

export * from "./bytes.ts";
export * from "./concurrency.ts";
export * from "./file-access.ts";
export { invalidJson, jsonByteLength, jsonStringChunks, ownJsonValue } from "./json.ts";
export * from "./native-binding.ts";
export * from "./native-files.ts";
export * from "./programs.ts";
export * from "./sessions.ts";
export * from "./usage-limit.ts";
