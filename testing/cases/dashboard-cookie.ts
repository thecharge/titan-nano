import { CookieCredential, DashboardRoute } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const dashboardCookieCases = {
  positive: [
    positive(
      "cookie lists runs and the list holds the run",
      [DashboardRoute.Runs, CookieCredential.Cookie],
      "200 true",
    ),
    positive(
      "cookie shows one run",
      [DashboardRoute.RunPrefix, CookieCredential.Cookie],
      "200 true",
    ),
    positive("cookie opens the page", [DashboardRoute.Page, CookieCredential.Cookie], "200 false"),
  ],
  negative: [
    rejected("no cookie is refused", [DashboardRoute.Runs, CookieCredential.None], "401 false"),
    rejected(
      "unknown cookie is refused",
      [DashboardRoute.Runs, CookieCredential.Wrong],
      "401 false",
    ),
    rejected(
      "agent token is not a cookie",
      [DashboardRoute.Runs, CookieCredential.Agent],
      "401 false",
    ),
    rejected(
      "person token is not a cookie",
      [DashboardRoute.Runs, CookieCredential.Person],
      "401 false",
    ),
    rejected(
      "cookie from a foreign page is forbidden",
      [DashboardRoute.Runs, CookieCredential.Foreign],
      "403 false",
    ),
  ],
};
