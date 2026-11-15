import { DashboardScenario, DashboardUsageFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const mixedNumbers =
  "passed 2100 1000 0.03 partial subtotal, 1 contribution missing 1 1 true true false";

export const dashboardCases = {
  positive: [
    positive(
      "login answers 303 with the cookie flags and no referrer",
      [DashboardScenario.Login],
      "303 HttpOnly; SameSite=Strict; Path=/ / no-referrer no-store",
    ),
    positive(
      "cookie lists the finished run as passed",
      [DashboardScenario.ListWithCookie],
      "200 passed",
    ),
    positive(
      "page carries the content security policy",
      [DashboardScenario.PageHeaders],
      "200 default-src 'self'",
    ),
    positive(
      "every script and style of the page comes from titan with the policy",
      [DashboardScenario.PageAssets],
      "200:true 200:true",
    ),
    positive(
      "reported numbers equal the usage route",
      [DashboardScenario.Numbers, DashboardUsageFixture.Reported],
      "passed 2100 1000 0.03 complete 1 1 true true true",
    ),
    positive(
      "backend without cost shows not reported",
      [DashboardScenario.Numbers, DashboardUsageFixture.NoCost],
      "passed 2100 1000 null not reported 1 1 true true false",
    ),
    positive(
      "one backend omitting cost shows a partial subtotal",
      [DashboardScenario.Numbers, DashboardUsageFixture.Mixed],
      mixedNumbers,
    ),
    positive(
      "run page shows the step, its surviving attempt and the answer hint",
      [DashboardScenario.Steps],
      "deliver survived 0 true",
    ),
    positive("reconnect after event 3 starts at event 4", [DashboardScenario.Replay], "200 id: 4"),
    positive(
      "proof answers are counted from board events",
      [DashboardScenario.ProofCounts],
      "2 1 1",
    ),
    positive("code and cookie stay out of logs and files", [DashboardScenario.NoLeak], "clean"),
  ],
  negative: [
    rejected("second use of a code is refused", [DashboardScenario.SecondLogin], "403"),
    rejected("wrong code is refused", [DashboardScenario.WrongCode], "403"),
    rejected("dashboard route without cookie is refused", [DashboardScenario.NoCookie], "401"),
    rejected("cookie with a foreign origin is refused", [DashboardScenario.ForeignOrigin], "403"),
    rejected(
      "post with a valid cookie answers 405 and changes no run file",
      [DashboardScenario.PostWithCookie],
      "405 unchanged",
    ),
    rejected("cookie alone does not open GET /runs", [DashboardScenario.CookieOnRuns], "401"),
    rejected("cookie alone does not answer a request", [DashboardScenario.CookieOnAnswer], "401"),
    rejected(
      "agent token is refused on a dashboard route",
      [DashboardScenario.AgentTokenOnDashboard],
      "401",
    ),
    rejected(
      "person token is refused on a dashboard route",
      [DashboardScenario.PersonTokenOnDashboard],
      "401",
    ),
    rejected("agent token cannot mint a login code", [DashboardScenario.AgentTokenMint], "403"),
    rejected("bad Last-Event-ID is refused", [DashboardScenario.BadCursor], "400"),
    rejected("unknown run answers 404", [DashboardScenario.UnknownRun], "404"),
  ],
};
