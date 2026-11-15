import { ErrorCode } from "@titan/constants";
import { negative, positive } from "@titan/test-factories";

export const secretScanCases = {
  positive: [
    positive("ordinary chunks", [["hello", " world"]], true),
    positive("prefix without the secret", [["synthetic-", "public"]], true),
  ],
  negative: [
    negative("secret in one buffer", [["synthetic-secret"]], { code: ErrorCode.SecretValue }),
    negative("secret crosses buffer boundaries", [["synthe", "tic-", "secret"]], {
      code: ErrorCode.SecretValue,
    }),
  ],
};
