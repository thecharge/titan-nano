import { HttpStatus, ServerTokenCheck } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverTokenCases = {
  positive: [
    positive("agent token lists runs", [ServerTokenCheck.Agent], HttpStatus.Ok),
    positive("person token lists runs", [ServerTokenCheck.Person], HttpStatus.Ok),
  ],
  negative: [
    rejected("no token is refused", [ServerTokenCheck.None], HttpStatus.Unauthorized),
    rejected("unrelated token is refused", [ServerTokenCheck.Wrong], HttpStatus.Unauthorized),
    rejected(
      "token without the bearer word is refused",
      [ServerTokenCheck.Bare],
      HttpStatus.Unauthorized,
    ),
    rejected("short token is refused", [ServerTokenCheck.Short], HttpStatus.Unauthorized),
  ],
};
