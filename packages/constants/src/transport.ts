export enum RunAction {
  Resume = "resume",
  Pause = "pause",
  Cancel = "cancel",
}
export enum ProcessSignal {
  Kill = "SIGKILL",
  Interrupt = "SIGINT",
  Terminate = "SIGTERM",
}

export enum SignalEvent {
  Abort = "abort",
}
export enum HttpMethod {
  Get = "GET",
  Post = "POST",
}
export enum HttpHeader {
  RuntimeBuild = "x-titan-runtime-build",
  Authorization = "authorization",
  ContentType = "content-type",
}
export const LocalServer = {
  File: "server.json",
  Host: "127.0.0.1",
  Protocol: "http:",
  Root: "/",
  Runs: "/runs",
  Events: "events",
  Artifacts: "artifacts",
  TokenMinimumLength: 64,
  TimeoutMilliseconds: 15_000,
  UnauthorizedStatus: 401,
  Bearer: "Bearer ",
  Json: "application/json",
} as const;
export enum FileEncoding {
  Utf8 = "utf8",
  Hex = "hex",
  Base64 = "base64",
}
export const SpawnIgnore = { Ignore: "ignore" } as const;
export enum JsonSchemaDirection {
  Input = "input",
}

export enum ErrorField {
  Code = "code",
}

export const HttpOriginHeader = "origin";

export const EmbeddedRuntimeBuild = "embedded";
