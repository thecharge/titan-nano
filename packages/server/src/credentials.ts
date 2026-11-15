import { randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { resolve } from "node:path";
import { atomicWrite } from "@titan/board";
import {
  ApprovalLevel,
  ErrorCode,
  ErrorField,
  FileEncoding,
  FileErrorCode,
  HttpHeader,
  LocalServer,
  ServerCredential,
  ServerLimit,
  TextSymbol,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { CredentialMessage } from "@titan/messages";
import { type ClientAuthority, PersonTokenSchema, type ServerCredentials } from "@titan/types";

async function readToken(path: string): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const metadata = await file.stat();
    if (
      !metadata.isFile() ||
      (metadata.mode & ServerCredential.ModeMask) !== ServerLimit.FileMode ||
      metadata.nlink !== ServerCredential.Links ||
      (process.getuid && metadata.uid !== process.getuid())
    )
      throw new TitanError(ErrorCode.PermissionDenied, CredentialMessage.Invalid);
    return PersonTokenSchema.parse((await readTokenBytes(file)).toString(FileEncoding.Utf8));
  } finally {
    await file.close();
  }
}

async function readTokenBytes(file: FileHandle): Promise<Buffer> {
  const bytes = Buffer.alloc(ServerCredential.FileBytes + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const chunk = await file.read(bytes, offset, bytes.length - offset, null);
    if (!chunk.bytesRead) break;
    offset += chunk.bytesRead;
  }
  return bytes.subarray(0, offset);
}

export async function personToken(home: string): Promise<string> {
  const path = resolve(home, ServerCredential.PersonFile);
  try {
    return await readToken(path);
  } catch (error) {
    if (!(error instanceof Error) || Reflect.get(error, ErrorField.Code) !== FileErrorCode.Missing)
      throw new TitanError(ErrorCode.PermissionDenied, CredentialMessage.Invalid);
  }
  const token = randomBytes(ServerCredential.RandomBytes).toString(FileEncoding.Hex);
  await atomicWrite(path, Buffer.from(token));
  return readToken(path);
}

function matches(header: string, token: string): boolean {
  const actual = Buffer.from(header);
  const expected = Buffer.from(LocalServer.Bearer + token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function authenticate(headers: Headers, tokens: ServerCredentials): ClientAuthority | null {
  const header = headers.get(HttpHeader.Authorization) ?? TextSymbol.Empty;
  if (matches(header, tokens.person)) return ApprovalLevel.Human;
  if (matches(header, tokens.agent)) return ApprovalLevel.Main;
  return null;
}

export async function readPersonToken(home: string): Promise<string> {
  try {
    return await readToken(resolve(home, ServerCredential.PersonFile));
  } catch {
    throw new TitanError(ErrorCode.PermissionDenied, CredentialMessage.Invalid);
  }
}
