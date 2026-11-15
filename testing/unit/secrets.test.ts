import { unit } from "@titan/test-factories";
import { secretScanCases } from "../cases/secrets.ts";
import { scanChunks } from "../factories/secrets.ts";

unit(scanChunks, secretScanCases);
