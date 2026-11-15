import { ErrorCode, SourceDescriptorFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const refused = { contents: null, error: ErrorCode.UnsupportedFile, descriptors: 0 };

export const sourceDescriptorCases = {
  positive: [
    positive("empty regular source remains readable", [SourceDescriptorFixture.Empty], {
      contents: "",
      error: null,
      descriptors: 0,
    }),
    positive("regular source retains its bytes", [SourceDescriptorFixture.Content], {
      contents: SourceDescriptorFixture.Contents,
      error: null,
      descriptors: 0,
    }),
  ],
  negative: [
    rejected(
      "null device cannot become an empty snapshot",
      [SourceDescriptorFixture.Null],
      refused,
    ),
    rejected(
      "zero device is refused before streaming bytes",
      [SourceDescriptorFixture.Zero],
      refused,
    ),
    rejected(
      "directory is refused before reading bytes",
      [SourceDescriptorFixture.Directory],
      refused,
    ),
  ],
};
