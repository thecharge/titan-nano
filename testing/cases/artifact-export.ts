import { ErrorCode, ArtifactExportFixture as Fixture } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const artifactExportCases = {
  positive: [
    positive("plain file has its verified metadata", [Fixture.Plain], true),
    positive("executable intent survives export", [Fixture.Executable], true),
    positive("binary copying crosses stream chunks", [Fixture.Binary], true),
    positive("nested report keeps its relative path", [Fixture.Nested], true),
    positive("CLI exports one checked file", [Fixture.Plain, true], true),
    positive("CLI exports a nested document without Git", [Fixture.Nested, true], true),
  ],
  negative: [
    negative("existing destination stays intact", [Fixture.Existing], { code: ErrorCode.Exists }),
    negative("linked target stays intact", [Fixture.LinkedTarget], { code: ErrorCode.Exists }),
    negative("linked parent cannot redirect export", [Fixture.LinkedParent], {
      code: ErrorCode.UnsafeSymlink,
    }),
    negative("missing parent is not created", [Fixture.MissingParent], {
      code: ErrorCode.UnsafePath,
    }),
    negative("file parent is refused", [Fixture.FileParent], { code: ErrorCode.UnsafePath }),
    negative("relative output is refused", [Fixture.Relative], { code: ErrorCode.Arguments }),
    negative("run storage cannot become export output", [Fixture.RunStorage], {
      code: ErrorCode.UnsafePath,
    }),
    negative("malformed artifact identifier is refused", [Fixture.InvalidId], {
      code: ErrorCode.ArtifactNotFound,
    }),
    negative("missing artifact identifier is refused", [Fixture.MissingId], {
      code: ErrorCode.ArtifactNotFound,
    }),
    negative("changed kept file cannot be exported", [Fixture.Changed], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("linked kept file cannot be exported", [Fixture.LinkedSource], {
      code: ErrorCode.UnsafeSymlink,
    }),
    negative("unfinished delivery cannot be exported", [Fixture.NotPassed], {
      code: ErrorCode.ArtifactUnavailable,
    }),
    negative("oversized export metadata fails before writing", [Fixture.OversizedMetadata], {
      code: ErrorCode.ArtifactExport,
    }),
    negative("filesystem refusal cannot look successful", [Fixture.LongName], {
      code: ErrorCode.ArtifactExport,
    }),
    negative("partial copy is removed", [Fixture.PartialWrite], { code: ErrorCode.ArtifactExport }),
    negative("changed source during copy is refused and removed", [Fixture.ChangedDuringCopy], {
      code: ErrorCode.SnapshotChanged,
    }),
    negative("a writer cannot publish missing content", [Fixture.MissingCopy], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("a writer cannot publish altered content", [Fixture.AlteredCopy], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("manifest conflict removes the incomplete export", [Fixture.ManifestConflict], {
      code: ErrorCode.ArtifactExport,
    }),
    negative("CLI preserves an existing directory", [Fixture.Existing, true], {
      code: ErrorCode.Exists,
    }),
    negative("CLI rejects relative output", [Fixture.Relative, true], {
      code: ErrorCode.Arguments,
    }),
  ],
};
