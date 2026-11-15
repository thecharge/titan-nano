import { resolve } from "node:path";
import { loadData, object } from "@titan/config";
import {
  ConfigFile,
  ErrorField,
  FileErrorCode,
  IoLimit,
  Newline,
  TextSymbol,
  UpdateCheck,
  UpdateFile,
  UpdateMode,
  UpdatePolicy,
} from "@titan/constants";
import { UpdateMessage, updateAvailable } from "@titan/messages";
import { captureCommand } from "@titan/process";
import { ownUpdateCheck } from "@titan/server/maintenance";
import { atomicWrite, readFileBytes } from "@titan/streams";
import {
  type ReleaseVersion,
  type UpdateCache,
  UpdateCacheSchema,
  type UpdateInspection,
  type UpdateRelease,
  type UpdateServices,
  UpdateSettingsSchema,
} from "@titan/types";

export function releaseVersion(value: string): ReleaseVersion | null {
  if (value.length > UpdatePolicy.VersionCharacters) return null;
  const match = UpdatePolicy.VersionPattern.exec(value);
  if (!match) return null;
  const prerelease = match[4]?.split(TextSymbol.Dot) ?? [];
  const invalid = prerelease.some(
    (part) =>
      UpdatePolicy.NumericPattern.test(part) &&
      part.length > 1 &&
      part.startsWith(UpdatePolicy.Zero),
  );
  if (invalid) return null;
  return {
    version: value,
    numbers: [BigInt(match[1] ?? 0), BigInt(match[2] ?? 0), BigInt(match[3] ?? 0)],
    prerelease,
  };
}

function compareIdentifier(left: string, right: string): number {
  if (left === right) return 0;
  const numericLeft = UpdatePolicy.NumericPattern.test(left);
  const numericRight = UpdatePolicy.NumericPattern.test(right);
  if (numericLeft && numericRight) return BigInt(left) < BigInt(right) ? -1 : 1;
  if (numericLeft !== numericRight) return numericLeft ? -1 : 1;
  return left < right ? -1 : 1;
}

export function compareRelease(left: ReleaseVersion, right: ReleaseVersion): number {
  for (let index = 0; index < left.numbers.length; index++) {
    const a = left.numbers[index] ?? 0n;
    const b = right.numbers[index] ?? 0n;
    if (a !== b) return a < b ? -1 : 1;
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0)
    return Number(right.prerelease.length > 0) - Number(left.prerelease.length > 0);
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const a = left.prerelease[index];
    const b = right.prerelease[index];
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    const compared = compareIdentifier(a, b);
    if (compared !== 0) return compared;
  }
  return 0;
}

export function newestRelease(tags: string, current: string): string | null {
  let newest = releaseVersion(current);
  if (!newest || Buffer.byteLength(tags) > UpdatePolicy.OutputBytes) return null;
  const lines = tags.split(Newline);
  if (lines.length > UpdatePolicy.MaximumTags) return null;
  for (const line of lines) {
    const match = UpdatePolicy.TagPattern.exec(line);
    const candidate = match
      ? releaseVersion(line.replace(UpdatePolicy.TagPrefixPattern, TextSymbol.Empty))
      : null;
    if (candidate && compareRelease(candidate, newest) > 0) newest = candidate;
  }
  return newest.version === current ? null : newest.version;
}

const updateServices: UpdateServices = {
  now: Date.now,
  async tags(source, cwd) {
    const result = await captureCommand(
      [UpdatePolicy.Git, ...UpdatePolicy.Arguments, source],
      cwd,
      { timeout_ms: UpdatePolicy.TimeoutMilliseconds, maximum_bytes: UpdatePolicy.OutputBytes },
    );
    if (result.exit_code !== 0) throw new Error(UpdateMessage.Failed);
    return result.stdout.toString();
  },
};

export async function updateSettings(home: string) {
  try {
    return UpdateSettingsSchema.parse(
      object(await loadData(resolve(home, ConfigFile.User))).update ?? {},
    );
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, ErrorField.Code) === FileErrorCode.Missing)
      return UpdateSettingsSchema.parse({});
    throw error;
  }
}

export async function inspectLatestRelease(
  home: string,
  version: string,
  services: UpdateServices = updateServices,
): Promise<UpdateInspection> {
  const settings = await updateSettings(home);
  const source = settings.source ?? null;
  if (settings.check === UpdateCheck.Never || settings.mode === UpdateMode.Off || !source)
    return { current_version: version, available_version: null, source, checked: false };
  const tags = await services.tags(source, home);
  return {
    current_version: version,
    available_version: newestRelease(tags, version),
    source,
    checked: true,
  };
}

async function cachedUpdate(path: string): Promise<UpdateCache | null> {
  try {
    const bytes = await readFileBytes(path, IoLimit.DataBytes);
    return UpdateCacheSchema.parse(JSON.parse(bytes.toString()));
  } catch {
    return null;
  }
}

function cachedNotice(cache: UpdateCache | null, version: string): string | null {
  if (!cache?.latest) return null;
  const latest = releaseVersion(cache.latest);
  const current = releaseVersion(version);
  return latest && current && compareRelease(latest, current) > 0
    ? updateAvailable(latest.version)
    : null;
}

async function inspectUpdates(home: string, version: string, services: UpdateServices) {
  const settings = await updateSettings(home);
  if (settings.check === UpdateCheck.Never || settings.mode === UpdateMode.Off || !settings.source)
    return null;
  const path = resolve(home, UpdatePolicy.CacheFile);
  await using resources = new AsyncDisposableStack();
  await ownUpdateCheck(home, resources);
  const previous = await cachedUpdate(path);
  const now = services.now();
  const cache = previous?.source === settings.source ? previous : null;
  if (cache && now >= cache.checked_at && now - cache.checked_at < UpdatePolicy.DayMilliseconds)
    return cachedNotice(cache, version);
  let latest = cache?.latest ?? null;
  try {
    latest = newestRelease(await services.tags(settings.source, home), version);
  } catch {}
  const next = { source: settings.source, checked_at: now, latest };
  await atomicWrite(path, Buffer.from(JSON.stringify(next)));
  return cachedNotice(next, version);
}

export async function checkUpdateNotice(
  home: string,
  version: string,
  services: UpdateServices = updateServices,
): Promise<string | null> {
  try {
    return await inspectUpdates(home, version, services);
  } catch {
    return null;
  }
}

export async function selectUpdateRelease(
  home: string,
  current: string,
  services: UpdateServices = updateServices,
): Promise<UpdateRelease | null> {
  const settings = await updateSettings(home);
  if (settings.check === UpdateCheck.Never || settings.mode === UpdateMode.Off || !settings.source)
    return null;
  const tags = await services.tags(settings.source, home);
  const version = newestRelease(tags, current);
  if (!version) return null;
  const line = tags
    .split(Newline)
    .find(
      (entry) =>
        UpdatePolicy.TagPattern.test(entry) &&
        entry.replace(UpdatePolicy.TagPrefixPattern, TextSymbol.Empty) === version,
    );
  if (!line) return null;
  return {
    source: settings.source,
    version,
    tag: line.replace(UpdateFile.RefPrefixPattern, TextSymbol.Empty),
    object: line.split(UpdateFile.FieldSeparator)[0] ?? TextSymbol.Empty,
  };
}
