import { MinimumBunVersion, UpdatePolicy } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

const buildPrefix = `${MinimumBunVersion}+`;
const maximumLengthRelease =
  buildPrefix + "a".repeat(UpdatePolicy.VersionCharacters - buildPrefix.length);

export const prerequisiteVersionCases = {
  positive: [
    positive("minimum release is ready", [MinimumBunVersion], true),
    positive("newer release is ready", ["1.4.0"], true),
    positive("build metadata preserves readiness", [`${MinimumBunVersion}+build.01`], true),
    positive("release at the parser length limit is ready", [maximumLengthRelease], true),
    positive(
      "newer release with a large major version is ready",
      [`${"9".repeat(UpdatePolicy.VersionCharacters - ".0.0".length)}.0.0`],
      true,
    ),
  ],
  negative: [
    rejected("malformed major version is rejected", ["invalid.3.10"], false),
    rejected("extra numeric component is rejected", [`${MinimumBunVersion}.0`], false),
    rejected("minimum release prerelease is rejected", [`${MinimumBunVersion}-beta.1`], false),
    rejected("older release prerelease is rejected", ["1.3.9-beta.1"], false),
    rejected("zero-padded numeric prerelease is rejected", ["1.4.0-beta.01"], false),
    rejected(
      "release above the parser length limit is rejected",
      [`${maximumLengthRelease}a`],
      false,
    ),
  ],
};
