export const WorkflowMessage = {
  Required: "Required",
  Root: "workflow",
  SourceRead: "Workflow source file is unavailable or its path is not absolute",
  SourceMismatch: "Workflow source file does not match the submitted plan",
  SourceInvalid: "Workflow source must be bytes within the supported allowance",
  GroupDepth: "Group nesting exceeds configured limit",
  LeanPlatform: "lean checks need Linux",
  Theorems: "theorems must name at least one theorem",
  UnknownVerifyKind: "kind must be lean, smt or script",
} as const;

export const personSetsWeight = (name: string): string =>
  `only the person sets ${name}, in ~/.titan/config.yaml`;

export const workflowIssue = (path: string, reason: string): string => `${path}: ${reason}`;

export const unsupportedPersonaFormat = (name: string): string =>
  `personas.${name}: unsupported input or output format`;
export const groupDependencies = (id: string): string => `${id}: needs is only valid in graph mode`;
export const duplicateStep = (id: string, first: string, second: string): string =>
  `Duplicate step id: ${id} at ${first} and ${second}`;
export const dependencyCycle = (path: string[]): string => `Dependency cycle: ${path.join(" -> ")}`;
export const missingDependency = (id: string): string => `Unknown dependency: ${id}`;
export const unfinishedInput = (id: string, producer: string): string =>
  `${id}.inputs: unfinished dependency. ${id} uses ${producer}, but ${producer} may not be finished before ${id} starts`;
export const inputFormatMismatch = (
  id: string,
  input: string,
  source: string,
  expected: Record<string, unknown>,
  actual: Record<string, unknown> | undefined,
): string =>
  `${id}.inputs.${input}: ${source} has a different format. Input format ${JSON.stringify(expected)}. Output format ${JSON.stringify(actual ?? null)}`;
export const unknownPersona = (id: string, persona: string): string =>
  `${id}: unknown persona "${persona}"`;
export const personaNotInRegister = (reference: string): string =>
  `persona "${reference}" is not in the register`;
export const selfFalsification = (id: string): string =>
  `${id}: a step cannot be falsified by its own persona`;

export const unsupportedPersonaTools = (name: string, tools: string[]): string =>
  `personas.${name}.tools: unsupported Claude invocation permissions: ${tools.join(", ")}`;
export const noFalsifier = (id: string): string => `${id}: every step needs at least one falsifier`;
export const missingJudge = (id: string): string => `${id}: candidates > 1 needs a judge`;
export const unresolvedPersona = (name: string): string =>
  `personas.${name}: a persona taken from the register is not resolved yet`;
export const stepPath = (prefix: string, index: number): string => `${prefix}[${index}]`;
export const nestedPath = (path: string, field: string): string => `${path}.${field}`;
export const unsafeStatement = (path: string): string =>
  `${path}: a statement path must stay inside the project folder`;
export const featurePending = (id: string, feature: string): string =>
  `${id}: ${feature} is not built yet in this preview`;
