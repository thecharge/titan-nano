import {
  ApiCredential,
  HttpMethod,
  HttpStatus,
  LocalServer,
  ServerRoute,
  ServerStartupFixture,
} from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const dashboardApiCases = {
  positive: [
    positive(
      "agent token and cookie together list runs",
      [LocalServer.Runs, HttpMethod.Get, ApiCredential.CookieAgent],
      HttpStatus.Ok,
    ),
    positive(
      "agent token alone lists runs",
      [LocalServer.Runs, HttpMethod.Get, ApiCredential.Agent],
      HttpStatus.Ok,
    ),
    positive(
      "person token alone lists runs",
      [LocalServer.Runs, HttpMethod.Get, ApiCredential.Person],
      HttpStatus.Ok,
    ),
  ],
  negative: [
    rejected(
      "cookie alone cannot list runs",
      [LocalServer.Runs, HttpMethod.Get, ApiCredential.Cookie],
      HttpStatus.Unauthorized,
    ),
    rejected(
      "cookie alone cannot list requests",
      [ServerStartupFixture.RequestsRoute, HttpMethod.Get, ApiCredential.Cookie],
      HttpStatus.Unauthorized,
    ),
    rejected(
      "cookie alone cannot read health",
      [ServerRoute.Health, HttpMethod.Get, ApiCredential.Cookie],
      HttpStatus.Unauthorized,
    ),
    rejected(
      "cookie alone cannot start a run",
      [LocalServer.Runs, HttpMethod.Post, ApiCredential.Cookie],
      HttpStatus.Unauthorized,
    ),
  ],
};
