import {
  DashboardRoute,
  DashboardSession,
  ErrorCode,
  ExitCode,
  HttpMethod,
} from "@titan/constants";
import { TitanError } from "@titan/errors";
import { DashboardMessage } from "@titan/messages";
import { type ClientConnector, type DashboardClient, DashboardCodeBodySchema } from "@titan/types";
import { createClientTransport, readAddress } from "./client.ts";

export function createDashboardClient(home: string, connect?: ClientConnector): DashboardClient {
  const person = createClientTransport(home, connect, true);
  return {
    async login() {
      const body = await person(DashboardRoute.Code, HttpMethod.Post, {});
      const origin = new URL((await readAddress(home)).url).origin;
      const parsed = DashboardCodeBodySchema.safeParse(body);
      if (
        !parsed.success ||
        !DashboardSession.CodePattern.test(parsed.data.code) ||
        parsed.data.url !== DashboardMessage.LoginLink(origin, parsed.data.code)
      )
        throw new TitanError(
          ErrorCode.InvalidResponse,
          DashboardMessage.Client,
          ExitCode.Transport,
        );
      return { link: parsed.data.url };
    },
  };
}
