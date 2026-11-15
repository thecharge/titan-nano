import type { SqlMethod } from "@titan/constants";
import type { RunSummary, StoredCatalog } from "../catalog.ts";

export type DescribeCatalog = (row: StoredCatalog) => Promise<RunSummary>;
export type CatalogDatabase = Pick<Bun.SQL, SqlMethod.Unsafe>;
