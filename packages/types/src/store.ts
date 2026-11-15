import { StoreEviction } from "@titan/constants";
import { z } from "zod";

export const StoreOptionsSchema = z.strictObject({
  maxEntries: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ttlMs: z.number().nonnegative().nullable().default(null),
  eviction: z.enum(StoreEviction).default(StoreEviction.LeastRecentlyUsed),
});
export type StoreOptions = z.input<typeof StoreOptionsSchema>;
export const storeEntrySchema = <V>(value: z.ZodType<V>) =>
  z.strictObject({ value, expiresAt: z.number().nullable() });
export type StoreEntry<V> = z.infer<ReturnType<typeof storeEntrySchema<V>>>;
export type StoreUpdate<V> = (value: V | undefined) => V | undefined;
