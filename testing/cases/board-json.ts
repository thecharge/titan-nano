import { BoardLimit, ErrorCode, JsonEncoding, JsonFixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

const invalid = { code: ErrorCode.JsonEncoding };
export const storedJsonCases = {
  positive: [
    positive("omitted event data keeps the null default", [JsonFixture.Undefined], true),
    positive(
      "compact projection stays inside the record budget",
      [JsonFixture.Projection, null, true],
      true,
    ),
    positive(
      "plain JSON commits and replays",
      [JsonFixture.Value, { value: [true, null, "😀"] }],
      true,
    ),
    positive("shared references commit and replay", [JsonFixture.Repeated, 3], true),
  ],
  negative: [
    negative("getter is rejected without consuming a sequence", [JsonFixture.Accessor], invalid),
    negative("cycle is rejected without consuming a sequence", [JsonFixture.Cycle], invalid),
    negative(
      "excessive depth preserves the journal",
      [JsonFixture.Deep, JsonEncoding.MaximumDepth + 1],
      invalid,
    ),
    negative("undefined preserves the journal", [JsonFixture.Value, { value: undefined }], invalid),
    negative("non-finite data preserves the journal", [JsonFixture.Value, Number.NaN], invalid),
    negative(
      "expanded repeated data exceeds the record allowance",
      [JsonFixture.Repeated, BoardLimit.RecordBytes / JsonEncoding.ChunkCharacters],
      { code: ErrorCode.DurableWrite },
    ),
  ],
};
