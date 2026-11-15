import { unit } from "@titan/test-factories";
import { streamWriteCases } from "../cases/stream-write.ts";
import { streamWrite } from "../factories/stream-write.ts";

unit(streamWrite, streamWriteCases);
