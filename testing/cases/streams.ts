import { IoLimit } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

export const collectedBytesCases = {
  positive: [
    positive("empty chunks allocate no retained data", [0, 1, 1, false], {
      correct: true,
      closed: true,
      produced: 0,
      code: null,
    }),
    positive(
      "binary chunks cross fixed buffer pages",
      [IoLimit.ChunkBytes + 7, 127, IoLimit.ChunkBytes + 7, false],
      {
        correct: true,
        closed: true,
        produced: Math.ceil((IoLimit.ChunkBytes + 7) / 127),
        code: null,
      },
    ),
    positive("reused source buffer cannot change earlier bytes", [6, 2, 6, false], {
      correct: true,
      closed: true,
      produced: 3,
      code: null,
    }),
  ],
  negative: [
    rejected("overflow closes source before further reads", [6, 2, 3, false], {
      correct: false,
      closed: true,
      produced: 2,
      code: "stream_limit",
    }),
    rejected("interrupted source cannot return partial data", [4, 2, 4, true], {
      correct: false,
      closed: true,
      produced: 2,
      code: "interrupted",
    }),
  ],
};

export const fileBytesCases = {
  positive: [
    positive("empty file is a zero-length buffer", [0, 1, true], true),
    positive(
      "binary file spans reader chunks",
      [IoLimit.ChunkBytes + 3, IoLimit.ChunkBytes + 3, true],
      true,
    ),
  ],
  negative: [
    negative(
      "oversized file is rejected during reading",
      [IoLimit.ChunkBytes + 1, IoLimit.ChunkBytes, true],
      { code: "stream_limit" },
    ),
    negative("zero budget never opens the source", [0, 0, false], { code: "invalid_stream_limit" }),
    negative("fractional budget never opens the source", [0, 1.5, false], {
      code: "invalid_stream_limit",
    }),
    negative("missing file is not an empty buffer", [0, 1, false], { code: "ENOENT" }),
  ],
};

export const handleBytesCases = {
  positive: [
    positive("empty borrowed handle remains owned by caller", [0], true),
    positive("binary borrowed handle spans multiple chunks", [IoLimit.ChunkBytes + 7], true),
  ],
  negative: [
    negative("closed handle propagates its read error", [1, true], { code: "EBADF" }),
    negative("directory handle cannot become empty file data", [0, false, true], {
      code: "EISDIR",
    }),
  ],
};
