import { RecoveryCheckpointMode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const recoveryCheckpointCases = {
  positive: [
    positive(
      "worker retry starts only after its durable date",
      [true, RecoveryCheckpointMode.Complete],
      true,
    ),
    positive(
      "checker retry starts only after its durable date",
      [false, RecoveryCheckpointMode.Complete],
      true,
    ),
    positive(
      "worker backoff stays visible through pause and resume",
      [true, RecoveryCheckpointMode.Pause],
      true,
    ),
    positive(
      "checker backoff stays visible through pause and resume",
      [false, RecoveryCheckpointMode.Pause],
      true,
    ),
    positive(
      "worker backoff retains its date after paused reload",
      [true, RecoveryCheckpointMode.Reload],
      true,
    ),
    positive(
      "checker backoff retains its date after paused reload",
      [false, RecoveryCheckpointMode.Reload],
      true,
    ),
    positive(
      "independent branch advances during worker backoff",
      [true, RecoveryCheckpointMode.Peer],
      true,
    ),
    positive(
      "independent branch advances during checker backoff",
      [false, RecoveryCheckpointMode.Peer],
      true,
    ),
  ],
  negative: [
    rejected(
      "cancelled worker backoff cannot restart an execution",
      [true, RecoveryCheckpointMode.Cancel],
      true,
    ),
    rejected(
      "cancelled checker backoff cannot restart an execution",
      [false, RecoveryCheckpointMode.Cancel],
      true,
    ),
    rejected(
      "worker backoff cannot hide an expired run deadline",
      [true, RecoveryCheckpointMode.Deadline],
      true,
    ),
    rejected(
      "checker backoff cannot hide an expired run deadline",
      [false, RecoveryCheckpointMode.Deadline],
      true,
    ),
  ],
};
