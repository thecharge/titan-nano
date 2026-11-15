export enum HarnessName {
  Claude = "claude",
  Codex = "codex",
  Antigravity = "antigravity",
}

export enum HarnessAuto {
  Value = "auto",
}

export enum DetectionSource {
  Flag = "flag",
  Workflow = "workflow",
  Environment = "env:",
}

export const HarnessSignals = [
  { harness: HarnessName.Claude, variable: "CLAUDECODE", value: "1" },
] as const;

export const HarnessCommands = [
  { harness: HarnessName.Claude, command: "claude" },
  { harness: HarnessName.Codex, command: "codex" },
  { harness: HarnessName.Antigravity, command: "agy" },
] as const;

export enum HarnessSdk {
  Claude = "@anthropic-ai/claude-agent-sdk",
  Codex = "@openai/codex-sdk",
  Antigravity = "google-antigravity",
}
export const HarnessChoices = "claude|codex|antigravity";

export enum SdkOwner {
  Runtime = "@titan/runtime",
  CodexManifest = "@openai/codex/package.json",
  Claude = "@titan/backend-claude",
  Codex = "@titan/backend-codex",
}

export const HarnessSdkOwners = [
  { sdk: HarnessSdk.Claude, owner: SdkOwner.Claude },
  { sdk: HarnessSdk.Codex, owner: SdkOwner.Codex },
] as const;

export const ModelVersionPattern = /(?:^|[-_.:])v?\d+(?:[._-]\d+)*$/;
