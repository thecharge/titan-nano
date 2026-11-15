import { ErrorCode, IoLimit } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const streamWriteCases = {
  positive: [
    positive("exact JSON byte budget replaces a file atomically", [null, 4, 4], true),
    positive(
      "escaped Unicode data streams across immutable bounded pages",
      [
        { text: "\n".repeat(IoLimit.ChunkBytes), marker: "😀" },
        IoLimit.DataBytes,
        IoLimit.DataBytes,
      ],
      true,
    ),
  ],
  negative: [
    negative(
      "encoder overflow after a written page preserves original bytes",
      ["x".repeat(IoLimit.ChunkBytes * 4), IoLimit.ChunkBytes * 2, IoLimit.DataBytes],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "writer overflow closes the producer and removes temporary bytes",
      ["x".repeat(IoLimit.ChunkBytes * 4), IoLimit.DataBytes, IoLimit.ChunkBytes],
      { code: ErrorCode.StreamLimit },
    ),
    negative(
      "late unsupported JSON removes previously streamed pages",
      [
        { prefix: "x".repeat(IoLimit.ChunkBytes * 2), invalid: undefined },
        IoLimit.DataBytes,
        IoLimit.DataBytes,
      ],
      { code: ErrorCode.JsonEncoding },
    ),
    negative("zero writer budget refuses before pulling a source", [null, IoLimit.DataBytes, 0], {
      code: ErrorCode.InvalidStreamLimit,
    }),
    negative(
      "invalid encoder budget preserves the target and closes its source",
      [null, 0, IoLimit.DataBytes],
      { code: ErrorCode.InvalidStreamLimit },
    ),
  ],
};
