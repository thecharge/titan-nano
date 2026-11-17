import { chmod, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { homePath } from "@titan/config";
import { KnownHome, ServerDatabaseAdapter, ServerLimit, TextSymbol } from "@titan/constants";
import { KnownHomePathSchema, KnownHomeRowSchema } from "@titan/types";
import { exists } from "@titan/workspace";

const path = () => resolve(homePath(), KnownHome.File);

export async function rememberHome(home: string): Promise<void> {
  if (!KnownHomePathSchema.safeParse(home).success) return;
  const parent = homePath();
  await mkdir(parent, { recursive: true, mode: ServerLimit.DirectoryMode });
  const file = resolve(parent, KnownHome.File);
  const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: file, strict: true });
  try {
    await database.unsafe(KnownHome.BusyTimeout);
    await database.unsafe(KnownHome.Create);
    await chmod(file, ServerLimit.FileMode);
    await database.unsafe(KnownHome.Insert, [home]);
  } finally {
    await database.close();
  }
}

export async function knownHomes(after = TextSymbol.Empty): Promise<(string | null)[]> {
  const file = path();
  if (!(await exists(file))) return [];
  const database = new Bun.SQL({ adapter: ServerDatabaseAdapter, filename: file, readonly: true });
  try {
    const rows = KnownHomeRowSchema.array().parse(
      await database.unsafe(KnownHome.Page, [after, ServerLimit.KnownHomePageSize + 1]),
    );
    return rows.map(({ path }) => KnownHomePathSchema.safeParse(path).data ?? null);
  } finally {
    await database.close();
  }
}
