export enum WorkflowField {
  Script = "script",
  Steps = "steps",
  Graph = "graph",
  Persona = "persona",
  Call = "call",
  Use = "use",
  Mutates = "mutates",
}

export enum VerifyKind {
  Lean = "lean",
  Smt = "smt",
  Script = "script",
}

export enum VerifyField {
  Kind = "kind",
  Statement = "statement",
  Solution = "solution",
}

export enum WorkflowPath {
  Steps = "steps",
  GraphNodes = "graph.nodes",
}

export enum PolicyField {
  Kind = "kind",
  TimeWeight = "w_time",
  AgentWeight = "w_agent",
}

export enum WorkflowIssueKind {
  Union = "invalid_union",
  Key = "invalid_key",
  UnrecognizedKeys = "unrecognized_keys",
}

export enum GroupField {
  Id = "id",
  Sequential = "sequential",
  Parallel = "parallel",
}

export enum SchemaKind {
  String = "string",
  Null = "null",
  Object = "object",
  Array = "array",
  Number = "number",
  Integer = "integer",
  Boolean = "boolean",
}

export const PersonaReferencePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$/;
export const ScopedPersonaReferencePattern =
  /^(?:project:)?[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}@[0-9]+$/;
export const ProjectPersonaPrefix = "project:";
