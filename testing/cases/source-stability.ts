import { IoLimit, SnapshotMutation } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const size = IoLimit.ChunkBytes * 3 + 1;
const refused = { refused: true, descriptors: 0 };
const retained = { refused: false, descriptors: 0 };

export const sourceStabilityCases = {
  positive: [
    positive("an unchanged empty source remains readable", [SnapshotMutation.None, 0], retained),
    positive(
      "an unchanged multi-chunk source remains readable",
      [SnapshotMutation.None, size],
      retained,
    ),
  ],
  negative: [
    rejected(
      "same-length writes during streaming are refused",
      [SnapshotMutation.Changed, size],
      refused,
    ),
    rejected("growth during streaming is refused", [SnapshotMutation.Grown, size], refused),
    rejected("deletion during streaming is refused", [SnapshotMutation.Deleted, size], refused),
    rejected(
      "replacement with equal bytes during streaming is refused",
      [SnapshotMutation.Metadata, size],
      refused,
    ),
  ],
};
