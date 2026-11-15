export const ArtifactFormat = {
  InspectionVersion: 1,
  PageVersion: 1,
  ExportVersion: 1,
  PageBytes: 64 * 1024,
  HashPattern: /^[a-f0-9]{64}$/,
} as const;
export enum ArtifactCommand {
  Export = "export",
  List = "list",
  Show = "show",
}
export enum ArtifactKind {
  File = "file",
}

export const ArtifactExportFile = {
  Content: "files",
  Manifest: "artifact.json",
} as const;

export enum ArtifactRequestFixture {
  Escalated = "escalated",
  EscalatedExecutable = "escalated_executable",
  EscalatedState = "escalated_state",
  EscalatedContent = "escalated_content",
  CurrentIdentity = "current_identity",
  Intermediate = "intermediate",
  MissingTail = "missing_tail",
  Plain = "plain",
  Executable = "executable",
  Content = "content",
  Mode = "mode",
  State = "state",
  Unrelated = "unrelated",
  Duplicate = "duplicate",
  Unsupported = "unsupported",
}
