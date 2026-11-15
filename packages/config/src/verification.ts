import { EnvVar } from "@titan/constants";

export function verificationEnvironment(
  home: string,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    ...inherited,
    [EnvVar.Home]: home,
    [EnvVar.XdgConfigHome]: home,
    [EnvVar.UserProfile]: home,
    [EnvVar.AppData]: home,
    [EnvVar.LocalAppData]: home,
  };
}
