export type SnapshotAction<T> = (directory: string) => Promise<T>;
export type HookRunner = (command: readonly string[], directory: string) => Promise<number>;
export type HookReporter = (message: string) => void;
export type EnvironmentHookRunner = (
  command: readonly string[],
  directory: string,
  environment: NodeJS.ProcessEnv,
) => Promise<number>;
