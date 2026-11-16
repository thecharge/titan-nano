export enum PrerequisiteName {
  Bun = "bun",
  Git = "git",
  Python = "python3",
  Lean = "lean",
  Z3 = "z3",
  Podman = "podman",
  Bubblewrap = "bwrap",
  Socat = "socat",
}

export const MinimumBunVersion = "1.3.10";
export const VersionSeparator = ".";

export const RequiredPrerequisites = [PrerequisiteName.Bun, PrerequisiteName.Git] as const;
export const OptionalPrerequisites = [
  PrerequisiteName.Python,
  PrerequisiteName.Lean,
  PrerequisiteName.Z3,
  PrerequisiteName.Podman,
  PrerequisiteName.Bubblewrap,
  PrerequisiteName.Socat,
] as const;
