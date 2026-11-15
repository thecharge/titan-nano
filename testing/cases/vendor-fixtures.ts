import { VendorFixture, VendorPreparationFixture } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const vendorFixturePreparationCases = {
  positive: [
    positive(
      "prepared Codex fixture retains its launcher",
      [VendorFixture.Codex, VendorPreparationFixture.Source],
      true,
    ),
    positive(
      "prepared Claude fixture retains its launcher",
      [VendorFixture.Claude, VendorPreparationFixture.Source],
      true,
    ),
  ],
  negative: [
    rejected(
      "missing fixture directory refuses preparation",
      [VendorFixture.Codex, VendorPreparationFixture.Missing],
      true,
    ),
    rejected(
      "malformed native helper refuses preparation",
      [VendorFixture.Claude, VendorPreparationFixture.Malformed],
      true,
    ),
  ],
};
