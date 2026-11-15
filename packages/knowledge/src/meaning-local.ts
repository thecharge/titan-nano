import { Database } from "bun:sqlite";
import { join } from "node:path";
import {
  EmbedderName,
  ErrorCode,
  KnowledgeMeaningLocal,
  LocalEmbedder,
  LocalModelEmbedderName,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { KnowledgeMessage } from "@titan/messages";
import {
  type Embedder,
  type KnowledgeMeaning,
  type KnowledgeVectorIndex,
  KnowledgeVectorRowsSchema,
} from "@titan/types";
import type * as SqliteVec from "sqlite-vec";

async function load<T>(name: string): Promise<T> {
  return (await import(name)) as T;
}

function bytes(vector: number[]): Uint8Array {
  const padded = new Float32Array(LocalEmbedder.Dimension);
  padded.set(vector);
  return new Uint8Array(padded.buffer);
}

export function unavailableEmbedder(name: string): Embedder {
  return {
    name,
    ready: async () => false,
    embed: async () => {
      throw new TitanError(ErrorCode.NotBuilt, KnowledgeMessage.EmbedderModelUnavailable);
    },
  };
}

export function selectEmbedder(embedders: readonly Embedder[] = [], configured?: string): Embedder {
  const requested = configured ?? embedders[0]?.name ?? EmbedderName.Local;
  const name =
    requested === EmbedderName.Local &&
    embedders.some((embedder) => embedder.name === LocalModelEmbedderName)
      ? LocalModelEmbedderName
      : requested;
  return embedders.find((embedder) => embedder.name === name) ?? unavailableEmbedder(name);
}

export async function openVectorIndex(path: string): Promise<KnowledgeVectorIndex> {
  const sqliteVec = await load<typeof SqliteVec>(KnowledgeMeaningLocal.SqliteVec);
  const database = new Database(path);
  try {
    sqliteVec.load(database);
    database.run(KnowledgeMeaningLocal.DropSql);
    database.run(KnowledgeMeaningLocal.CreateSql);
  } catch (error) {
    database.close();
    throw error;
  }
  const remove = async (id: string) => {
    database.run(KnowledgeMeaningLocal.DeleteSql, [id]);
  };
  return {
    remove,
    replace: async (id, vector) => {
      await remove(id);
      database.run(KnowledgeMeaningLocal.InsertSql, [id, bytes(vector)]);
    },
    nearest: async (vector, limit) =>
      KnowledgeVectorRowsSchema.parse(
        database.query(KnowledgeMeaningLocal.NearestSql).all(bytes(vector), limit),
      ).map((row) => ({
        id: row.id,
        score: Math.max(
          0,
          KnowledgeMeaningLocal.Full - row.distance ** 2 * KnowledgeMeaningLocal.HalfSquare,
        ),
      })),
    close: async () => {
      database.close();
    },
  };
}

export function localMeaning(home: string, embedder: Embedder): KnowledgeMeaning {
  return {
    embedder,
    open: () => openVectorIndex(join(home, KnowledgeMeaningLocal.VectorFile)),
  };
}
