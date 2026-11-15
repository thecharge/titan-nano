import { modelFetchNotice } from "@titan/messages";
import type { CliServices, LocalModelStatus } from "@titan/types";

export async function modelStatus(
  services: CliServices,
  home: string,
  download: boolean,
): Promise<LocalModelStatus> {
  const status = await services.inspectModel(home);
  if (!download || status.ready) return status;
  services.notice(modelFetchNotice(status.name, status.bytes));
  return services.fetchModel(home);
}
