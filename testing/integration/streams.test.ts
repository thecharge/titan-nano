import { unit } from "@titan/test-factories";
import { collectedBytesCases, fileBytesCases, handleBytesCases } from "../cases/streams.ts";
import { collectedBytes, fileBytes, handleBytes } from "../factories/streams.ts";

unit(collectedBytes, collectedBytesCases);
unit(fileBytes, fileBytesCases);

unit(handleBytes, handleBytesCases);
