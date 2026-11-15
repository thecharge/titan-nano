import { test } from "bun:test";
import { EmbedderGate } from "@titan/constants";
import { realModelFindsRelated } from "../factories/embedder-model.ts";

test(
  "the prepared real model finds a related entry offline",
  realModelFindsRelated,
  EmbedderGate.TimeoutMilliseconds,
);
