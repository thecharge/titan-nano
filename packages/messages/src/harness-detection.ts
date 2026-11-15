export const noHarness = (found: string[], missing: string[], choices: string): string =>
  `No agent tool was detected. Found on the PATH: ${found.join(", ") || "none"}. Not found: ${missing.join(", ") || "none"}. Use --harness ${choices}`;
export const ambiguousHarness = (variables: string[], choices: string): string =>
  `More than one agent tool was detected (${variables.join(", ")}). Use --harness ${choices}`;
export const unknownHarness = (name: string): string => `Unknown agent tool: ${name}`;
export const harnessLine = (harness: string, detectedBy: string): string =>
  `${harness} (${detectedBy})`;
export const toolLine = (command: boolean, sdk: boolean): string =>
  `command: ${command ? "found" : "missing"}, sdk: ${sdk ? "found" : "missing"}`;
export const harnessNone = "none detected";
