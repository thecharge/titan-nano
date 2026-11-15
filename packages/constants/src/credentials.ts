export const ServerCredential = {
  PersonFile: "person-token",
  RandomBytes: 32,
  TokenCharacters: 64,
  FileBytes: 128,
  ModeMask: 0o7777,
  Links: 1,
  Pattern: /^[a-f0-9]{64}$/,
} as const;

export enum CredentialFixture {
  Fresh = "fresh",
  Reuse = "reuse",
  Human = "human",
  OriginAgent = "origin_agent",
  OriginHuman = "origin_human",
  NoToken = "no_token",
  InvalidToken = "invalid_token",
  Linked = "linked",
  HardLink = "hard_link",
  BroadMode = "broad_mode",
  InvalidFile = "invalid_file",
  LargeFile = "large_file",
  LineEnding = "line_ending",
  Directory = "directory",
}
