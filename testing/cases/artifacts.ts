import {
  ArtifactFormat,
  ArtifactInspectionTransport,
  ArtifactKind,
  ArtifactMutation,
  ArtifactResultFixture,
  ErrorCode,
  ExitCode,
  RunStatus,
} from "@titan/constants";
import { hash } from "@titan/core";
import { negative, positive, rejected } from "@titan/test-factories";

export const dashboardConfigurationDeliveryCases = {
  positive: [
    positive("actual server retains committed settings and sources", [false, false], true),
    positive("editing owner settings preserves the run configuration", [true, false], true),
  ],
  negative: [
    rejected("actual configuration route requires its cookie", [false, true], true),
    rejected("actual configuration route refuses owner-file selection", [true, true], true),
  ],
};

const files = {
  paths: ["added.txt", "source.txt"],
  bytes: [8, 9],
  contentHashes: [hash(Buffer.from("new file")), hash(Buffer.from("delivered"))],
  stableIds: true,
  workflowIdentity: true,
  originalPreserved: true,
};
export const dashboardArtifactDeliveryCases = {
  positive: [
    positive("dashboard cookies inspect the committed verified delivery", [false, false], {
      status: 200,
      valid: true,
    }),
    positive("dashboard cookies read an exact bounded file page", [true, false], {
      status: 200,
      valid: true,
    }),
  ],
  negative: [
    rejected("changed artifact bytes invalidate the manifest view", [false, true], {
      status: 400,
      valid: true,
    }),
    rejected("changed artifact bytes cannot be displayed as valid file content", [true, true], {
      status: 400,
      valid: true,
    }),
  ],
};
export const artifactReviewCases = {
  positive: [
    positive(
      "ordinary delivered files are independently verifiable",
      [ArtifactMutation.None, false],
      { ...files, executable: [false, false] },
    ),
    positive("executable delivery keeps file identity and intent", [ArtifactMutation.None, true], {
      ...files,
      executable: [false, true],
    }),
    positive(
      "uppercase filename order preserves valid delivery",
      [ArtifactMutation.None, false, "Zeta.txt"],
      {
        ...files,
        paths: ["source.txt", "Zeta.txt"],
        bytes: [9, 8],
        contentHashes: [hash(Buffer.from("delivered")), hash(Buffer.from("new file"))],
        executable: [false, false],
      },
    ),
    positive(
      "case-distinct paths preserve valid delivery",
      [ArtifactMutation.None, true, "Source.txt"],
      {
        ...files,
        paths: ["source.txt", "Source.txt"],
        bytes: [9, 8],
        contentHashes: [hash(Buffer.from("delivered")), hash(Buffer.from("new file"))],
        executable: [true, false],
      },
    ),
  ],
  negative: [
    negative(
      "matching altered outputs and result cannot replace committed node outputs",
      [ArtifactMutation.OutputsAndResult],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative("manifest cannot omit a kept file", [ArtifactMutation.MissingPath], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("manifest cannot duplicate a kept file", [ArtifactMutation.DuplicatePath], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative(
      "matching altered files and manifest cannot replace the journal commitment",
      [ArtifactMutation.ContentAndManifest],
      { code: ErrorCode.ArtifactInvalid },
    ),
    negative("changed file bytes", [ArtifactMutation.Content], { code: ErrorCode.ArtifactInvalid }),
    negative("changed executable intent", [ArtifactMutation.Mode], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("changed manifest digest", [ArtifactMutation.Hash], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("unsafe manifest paths", [ArtifactMutation.Paths], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("changed manifest outputs", [ArtifactMutation.Outputs], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("changed result document", [ArtifactMutation.Result], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("malformed manifest", [ArtifactMutation.Malformed], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("missing manifest", [ArtifactMutation.MissingManifest], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("linked artifact directory", [ArtifactMutation.DirectoryLink], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("linked manifest", [ArtifactMutation.ManifestLink], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("linked result document", [ArtifactMutation.ResultLink], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("linked artifact file", [ArtifactMutation.FileLink], {
      code: ErrorCode.UnsafeSymlink,
    }),
    negative("unfinished delivery", [ArtifactMutation.NotPassed], {
      code: ErrorCode.ArtifactUnavailable,
    }),
    negative("missing delivered directory binding", [ArtifactMutation.MissingDirectory], {
      code: ErrorCode.ArtifactUnavailable,
    }),
    negative("outside delivered directory binding", [ArtifactMutation.WrongDirectory], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("wrong final journal event", [ArtifactMutation.JournalType], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("wrong committed artifact digest", [ArtifactMutation.JournalHash], {
      code: ErrorCode.ArtifactInvalid,
    }),
    negative("missing committed event", [ArtifactMutation.JournalEmpty], {
      code: ErrorCode.ArtifactInvalid,
    }),
  ],
};

export const artifactInspectionCases = {
  positive: [
    positive(
      "Http verifies ordinary delivery",
      [ArtifactInspectionTransport.Http, ArtifactMutation.None, false],
      true,
    ),
    positive(
      "Http verifies executable delivery",
      [ArtifactInspectionTransport.Http, ArtifactMutation.None, true],
      true,
    ),
    positive(
      "Cli verifies ordinary delivery",
      [ArtifactInspectionTransport.Cli, ArtifactMutation.None, false],
      true,
    ),
    positive(
      "Cli verifies executable delivery",
      [ArtifactInspectionTransport.Cli, ArtifactMutation.None, true],
      true,
    ),
    positive(
      "Mcp verifies ordinary delivery",
      [ArtifactInspectionTransport.Mcp, ArtifactMutation.None, false],
      true,
    ),
    positive(
      "Mcp verifies executable delivery",
      [ArtifactInspectionTransport.Mcp, ArtifactMutation.None, true],
      true,
    ),
  ],
  negative: [
    rejected(
      "Http refuses changed content",
      [ArtifactInspectionTransport.Http, ArtifactMutation.Content],
      true,
    ),
    rejected(
      "Http refuses changed outputs",
      [ArtifactInspectionTransport.Http, ArtifactMutation.Outputs],
      true,
    ),
    rejected(
      "Cli refuses changed content",
      [ArtifactInspectionTransport.Cli, ArtifactMutation.Content],
      true,
    ),
    rejected(
      "Cli refuses changed outputs",
      [ArtifactInspectionTransport.Cli, ArtifactMutation.Outputs],
      true,
    ),
    rejected(
      "Mcp refuses changed content",
      [ArtifactInspectionTransport.Mcp, ArtifactMutation.Content],
      true,
    ),
    rejected(
      "Mcp refuses changed outputs",
      [ArtifactInspectionTransport.Mcp, ArtifactMutation.Outputs],
      true,
    ),
  ],
};

const emptyInspection = {
  schema_version: ArtifactFormat.InspectionVersion,
  run_id: "delivery",
  workflow_id: "workflow",
  workflow_revision: "a".repeat(64),
  state: RunStatus.Passed,
  directory: "/kept/artifacts",
  result: "/kept/result.md",
  manifest: "/kept/artifacts.json",
  hash: "b".repeat(64),
  files: [],
  outputs: {},
};
const oneFile = {
  id: hash("source.txt"),
  kind: ArtifactKind.File,
  path: "source.txt",
  hash: hash("content"),
  bytes: 7,
  executable: false,
};
const invalidDigestFile = { ...oneFile, hash: "invalid" };
const escapingFile = { ...oneFile, path: "../outside" };
const reservedFile = { ...oneFile, path: ".titan/agent-writer.db" };
export const artifactResponseCases = {
  positive: [
    positive("an empty kept delivery is typed", [emptyInspection], 0),
    positive("file metadata is typed", [{ ...emptyInspection, files: [oneFile] }], 1),
  ],
  negative: [
    negative(
      "another empty delivery cannot replace the selected run",
      [{ ...emptyInspection, run_id: "other-run" }],
      {
        code: ErrorCode.InvalidResponse,
        exitCode: ExitCode.Transport,
      },
    ),
    negative(
      "another populated delivery cannot replace the selected run",
      [{ ...emptyInspection, run_id: "other-run", files: [oneFile] }],
      {
        code: ErrorCode.InvalidResponse,
        exitCode: ExitCode.Transport,
      },
    ),
    negative("future inspection version is refused", [{ ...emptyInspection, schema_version: 2 }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative(
      "invalid content digest is refused",
      [{ ...emptyInspection, files: [invalidDigestFile] }],
      { code: ErrorCode.InvalidResponse },
    ),
    negative("escaping file path is refused", [{ ...emptyInspection, files: [escapingFile] }], {
      code: ErrorCode.InvalidResponse,
    }),
    negative("reserved file path is refused", [{ ...emptyInspection, files: [reservedFile] }], {
      code: ErrorCode.InvalidResponse,
    }),
  ],
};

export const artifactResultRecordCases = {
  positive: [
    positive(
      "legacy ordinary delivery remains inspectable",
      [ArtifactResultFixture.LegacyOrdinary],
      true,
    ),
    positive(
      "legacy executable delivery remains inspectable",
      [ArtifactResultFixture.LegacyExecutable],
      true,
    ),
  ],
  negative: [
    rejected(
      "manifest cannot downgrade a committed report format",
      [ArtifactResultFixture.Downgrade],
      true,
    ),
    rejected(
      "report cannot change a committed attempt count",
      [ArtifactResultFixture.Attempts],
      true,
    ),
  ],
};
