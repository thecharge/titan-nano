import { unit } from "@titan/test-factories";
import { recoveryCheckpointCases } from "../cases/recovery-checkpoint.ts";
import { recoveryCheckpoint } from "../factories/recovery-checkpoint.ts";

unit(recoveryCheckpoint, recoveryCheckpointCases);
