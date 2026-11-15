import { UpdatePhase } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const updateInstallationCases = {
  positive: [
    positive(
      "local package switches the managed launcher after actual doctor and backup validation",
      ["success"],
      true,
    ),
    positive("an earlier backup is preserved in the new verified backup", ["earlier-backup"], true),
    positive("a retained run catalog and journal survive staged validation", ["journal"], true),
  ],
  negative: [
    rejected("a failing staged doctor retains the original release and data", ["failed"], true),
    rejected("a failing staged doctor retains existing run history", ["journal-failed"], true),
    rejected("malformed staged output retains the original release and data", ["malformed"], true),
    rejected("missing required tools retain the original release and data", ["missing-tool"], true),
    rejected("a downgrade retains the original release and data", ["older"], true),
    rejected(
      "an externally changed launcher is retained for owner review",
      ["changed-launcher"],
      true,
    ),
  ],
};

export const updateSourceBuildCases = {
  positive: [
    positive("a lightweight tag builds the pinned local release", ["success"], true),
    positive("an annotated tag builds its pinned tag object", ["annotated"], true),
  ],
  negative: [
    rejected("a changed tag object refuses the build", ["changed-object"], true),
    rejected("a mismatched manifest version refuses the build", ["wrong-version"], true),
    rejected("a failed package build refuses installation", ["failed-build"], true),
    rejected("multiple release archives refuse installation", ["extra-archive"], true),
  ],
};

export const automaticUpdateCases = {
  positive: [
    positive(
      "automatic installation hands the original command to the new launcher",
      ["success"],
      true,
    ),
    positive("an idle daemon drains before automatic installation", ["idle"], true),
    positive(
      "an incompatible idle daemon drains before automatic installation",
      ["idle-version"],
      true,
    ),
  ],
  negative: [
    rejected("notify mode retains the selected release", ["notify"], true),
    rejected("off mode makes no query or home writes", ["off"], true),
    rejected("a failed automatic doctor preserves the original command", ["failed"], true),
    rejected(
      "a package with another version cannot replace the selected source release",
      ["wrong-release"],
      true,
    ),
    rejected("active work defers automatic installation and retains the daemon", ["busy"], true),
  ],
};

export const updateInterruptionCases = {
  positive: [
    positive(
      "a killed updater releases backup ownership and recovers once",
      [UpdatePhase.BackedUp],
      true,
    ),
    positive(
      "a killed updater retains the completed package and original data",
      [UpdatePhase.Installed],
      true,
    ),
  ],
  negative: [
    rejected(
      "interruption after validation restores admission through the earlier release",
      [UpdatePhase.Verified],
      true,
    ),
    rejected(
      "interruption after launcher switching restores the earlier launcher",
      [UpdatePhase.Switched],
      true,
    ),
  ],
};

export const updateRecoveryCases = {
  positive: [
    positive("an interrupted preparation recovers before replacement startup", ["preparing"], true),
    positive("an interrupted backup retains its verified copy", ["backed-up"], true),
    positive(
      "an interrupted package installation recovers without repeated effects",
      ["installed"],
      true,
    ),
    positive("an interrupted package validation recovers before switching", ["verified"], true),
    positive("an interrupted launcher switch restores the earlier release", ["switched"], true),
  ],
  negative: [
    rejected("a damaged backup retains the recovery barrier", ["damaged-backup"], true),
    rejected("another installation cannot claim the transaction", ["wrong-installation"], true),
    rejected(
      "an unmanaged restoration target retains the recovery barrier",
      ["unsafe-target"],
      true,
    ),
  ],
};

export const updateAdmissionCases = {
  positive: [
    positive("an unconfigured source preserves the current managed release", ["current"], true),
    positive("an installation used as home can inspect the current release", ["same-home"], true),
  ],
  negative: [
    rejected("missing executable services refuse installation", ["missing-executable"], true),
    rejected("an unmanaged entry cannot replace the launcher", ["unmanaged"], true),
    rejected("a directory cannot be installed as an archive", ["directory"], true),
    rejected("an invalid archive retains the current release and backup", ["archive-failed"], true),
    rejected("a preparation failure rolls back before backup", ["before-backup"], true),
    rejected(
      "a removed pending transaction cannot select an absent package",
      ["removed-transaction"],
      true,
    ),
  ],
};
