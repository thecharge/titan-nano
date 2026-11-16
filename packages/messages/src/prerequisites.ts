import { MinimumBunVersion, PrerequisiteName } from "@titan/constants";

export const prerequisiteRepair: Record<PrerequisiteName, string> = {
  [PrerequisiteName.Bun]: `Install Bun ${MinimumBunVersion} or newer from https://bun.sh`,
  [PrerequisiteName.Git]: "Install Git with your system package manager",
  [PrerequisiteName.Python]: "Optional. Install Python 3 to run Python checks",
  [PrerequisiteName.Lean]: "Optional. Install Lean 4 with elan to run Lean proofs",
  [PrerequisiteName.Z3]: "Optional. Install Z3 to run SMT checks",
  [PrerequisiteName.Bubblewrap]:
    "Optional. Install bubblewrap for scoped Claude shell commands on Linux",
  [PrerequisiteName.Socat]: "Optional. Install socat for scoped Claude shell commands on Linux",
  [PrerequisiteName.Podman]: "Optional. Install rootless Podman to run the offline test suite",
};
export const harnessRepair = (command: string): string =>
  `Install the ${command} command and put it on the PATH`;
export const missingRequired = (names: string[]): string =>
  `Install stopped before writing any file. Missing required tools: ${names.join(", ")}. Run titan doctor for the repair steps`;
