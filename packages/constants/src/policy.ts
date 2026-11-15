export const PolicyDefault = {
  TimeWeight: 0.05,
  AgentWeight: 0.01,
  Scale: 1000000,
  FileLimit: 1048576,
} as const;

export const TrailFade = 0.98;

export enum PolicyStore {
  Directory = "policy",
  Extension = ".json",
  General = "general",
  Indent = 2,
}
