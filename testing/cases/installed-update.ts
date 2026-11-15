import { positive, rejected } from "@titan/test-factories";

export const installedUpdateCases = {
  positive: [
    positive(
      "a self-contained installed release upgrades through the stable launcher",
      ["success"],
      true,
    ),
    positive("an installed upgrade retains earlier backups", ["earlier-backup"], true),
  ],
  negative: [
    rejected("a packaged doctor failure retains the earlier installed release", ["failed"], true),
    rejected(
      "malformed packaged doctor output retains the earlier installed release",
      ["malformed"],
      true,
    ),
  ],
};
