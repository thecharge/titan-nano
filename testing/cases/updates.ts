import { ConfigScope, ErrorCode, UpdatePolicy } from "@titan/constants";
import { negative, positive, rejected } from "@titan/test-factories";

const tag = (version: string) => `${"a".repeat(40)}\trefs/tags/${version}`;

export const updateQueryDeadlineCases = {
  positive: [
    positive("a timed out notice preserves text command output", [false, false], true),
    positive("a timed out notice preserves JSON command output", [false, true], true),
  ],
  negative: [
    rejected("an explicit text check terminates the entire query group", [true, false], true),
    rejected("an explicit JSON check reports its deadline without home writes", [true, true], true),
  ],
};

export const updateNoticeLeaseCases = {
  positive: [
    positive("a fresh update query lease is private", ["plain"], true),
    positive("an existing regular query lease is retained", ["plain-existing"], true),
  ],
  negative: [
    rejected("a symbolic query lease preserves the external SQLite file", ["symbolic"], true),
    rejected("a hard-linked query lease preserves external permissions", ["hard"], true),
    rejected("a symbolic query companion is refused", ["symbolic-companion"], true),
    rejected("a hard-linked query companion is refused", ["hard-companion"], true),
  ],
};

export const updateUnavailableSourceCases = {
  positive: [
    positive("cached availability survives a failed refresh", ["cached-failure"], true),
    positive("disabled unavailable source remains offline", ["disabled"], true),
  ],
  negative: [
    rejected("missing Git repository", ["missing"], true),
    rejected("ordinary file is not a Git repository", ["file"], true),
  ],
};

export const releaseComparisonCases = {
  positive: [
    positive("equal stable versions", ["1.0.0", "1.0.0"], 0),
    positive("major version", ["2.0.0", "1.9.9"], 1),
    positive("minor version", ["1.10.0", "1.9.9"], 1),
    positive("patch version", ["1.0.10", "1.0.9"], 1),
    positive("numeric prerelease", ["1.0.0-beta.10", "1.0.0-beta.2"], 1),
    positive("stable follows prerelease", ["1.0.0", "1.0.0-rc.1"], 1),
    positive("longer prerelease", ["1.0.0-beta.1", "1.0.0-beta"], 1),
    positive("equal prereleases", ["1.0.0-beta.1", "1.0.0-beta.1"], 0),
    positive("build metadata has equal precedence", ["1.0.0+abc", "1.0.0+xyz"], 0),
    positive(
      "large versions preserve integer precision",
      ["9007199254740993.0.0", "9007199254740992.0.0"],
      1,
    ),
    positive("letters follow numeric prereleases", ["1.0.0-alpha", "1.0.0-1"], 1),
  ],
  negative: [
    rejected("older major", ["1.9.9", "2.0.0"], -1),
    rejected("older numeric prerelease", ["1.0.0-beta.2", "1.0.0-beta.10"], -1),
    rejected("prerelease precedes stable", ["1.0.0-rc.1", "1.0.0"], -1),
    rejected("shorter prerelease", ["1.0.0-beta", "1.0.0-beta.1"], -1),
    rejected("lexical prerelease", ["1.0.0-alpha", "1.0.0-beta"], -1),
    rejected("opposite lexical prerelease", ["1.0.0-beta", "1.0.0-alpha"], 1),
    rejected("numeric prerelease precedes letters", ["1.0.0-1", "1.0.0-alpha"], -1),
    rejected("invalid current", ["invalid", "1.0.0"], null),
    rejected("invalid next", ["1.0.0", "invalid"], null),
    rejected("leading version zero", ["01.0.0", "1.0.0"], null),
    rejected("leading prerelease zero", ["1.0.0-alpha.01", "1.0.0"], null),
    rejected(
      "version size bound",
      [`1.0.0-${"a".repeat(UpdatePolicy.VersionCharacters)}`, "1.0.0"],
      null,
    ),
  ],
};

export const releaseTagsCases = {
  positive: [
    positive(
      "newest semantic version",
      [[tag("v1.2.0"), tag("1.10.0"), tag("1.3.0")], "1.0.0"],
      "1.10.0",
    ),
    positive(
      "stable after prerelease",
      [[tag("v1.0.0"), tag("v1.0.0-rc.2")], "1.0.0-alpha.1"],
      "1.0.0",
    ),
    positive("build metadata retained", [[tag("v2.0.0+build.2")], "1.0.0"], "2.0.0+build.2"),
  ],
  negative: [
    rejected("older and equal tags", [[tag("0.9.0"), tag("1.0.0")], "1.0.0"], null),
    rejected(
      "malformed refs and numeric prereleases",
      [["junk", `${tag("2.0.0")}^{}`, tag("1.0.0-alpha.01"), tag("02.0.0")], "1.0.0"],
      null,
    ),
    rejected("invalid installed version", [[tag("2.0.0")], "invalid"], null),
    rejected(
      "bounded tag count",
      [Array(UpdatePolicy.MaximumTags + 1).fill(tag("2.0.0")), "1.0.0"],
      null,
    ),
    rejected("bounded tag bytes", [["a".repeat(UpdatePolicy.OutputBytes + 1)], "1.0.0"], null),
  ],
};

export const validUpdateSettingsCases = {
  positive: [
    positive("default check policy", [{}], true),
    positive("local repository path with spaces", [{ source: "/a release repository" }], true),
    positive("Git source", [{ source: "https://example.com/releases.git" }], true),
    positive(
      "SSH source",
      [{ source: "git@example.com:project/releases.git", check: "never" }],
      true,
    ),
  ],
  negative: [
    rejected("Git option source", [{ source: "--upload-pack=bad" }], false),
    rejected("control character source", [{ source: "https://example.com/\u0000.git" }], false),
    rejected("blank source", [{ source: "   " }], false),
    rejected("unknown check mode", [{ check: "always" }], false),
    rejected("unknown settings", [{ source: "local", arbitrary: true }], false),
  ],
};

export const updateOwnerSettingsCases = {
  positive: [
    positive("owner sets source", [{ update: { source: "local" } }, ConfigScope.User], {
      source: "local",
      check: "daily",
    }),
    positive("owner disables checks", [{ update: { check: "never" } }, ConfigScope.User], {
      check: "never",
    }),
  ],
  negative: [
    negative(
      "project cannot change source",
      [{ update: { source: "local" } }, ConfigScope.Project],
      { code: ErrorCode.OwnerSetting, message: "Release update settings belong to the home owner" },
    ),
    negative(
      "project cannot enable checks",
      [{ update: { check: "daily" } }, ConfigScope.Project],
      { code: ErrorCode.OwnerSetting, message: "Release update settings belong to the home owner" },
    ),
  ],
};

export const updateNoticeLifecycleCases = {
  positive: [
    positive("daily cache refresh", ["daily"], true),
    positive("source changes invalidate cache", ["source"], true),
    positive("corrupt cache is rebuilt", ["corrupt-cache"], true),
    positive("future cache cannot postpone checks", ["future"], true),
  ],
  negative: [
    rejected("disabled checks stay offline", ["never"], true),
    rejected("missing settings stay offline", ["missing"], true),
    rejected("invalid settings preserve command behavior", ["invalid"], true),
    rejected("source failure is cached without a notice", ["failure"], true),
  ],
};

export const updateConcurrentNoticeCases = {
  positive: [
    positive("one daily query under contention", [false, "1.0.0"], true),
    positive("equal installed release under contention", [false, "2.0.0"], true),
  ],
  negative: [
    rejected("one failed query under contention", [true, "1.0.0"], true),
    rejected("newer installed release suppresses notice", [false, "3.0.0"], true),
  ],
};

export const updateReadOnlyCheckCases = {
  positive: [
    positive("explicit check changes no files", [false, false], true),
    positive("empty home changes no files", [false, true], true),
  ],
  negative: [
    rejected("disabled explicit check changes no files", [true, false], true),
    rejected("disabled empty check changes no files", [true, true], true),
  ],
};

export const updateCommandNoticeCases = {
  positive: [
    positive("notice has a separate sink with text output", [false, true], true),
    positive("notice has a separate sink with JSON output", [true, true], true),
  ],
  negative: [
    rejected("no text notice without newer release", [false, false], true),
    rejected("no JSON notice without newer release", [true, false], true),
  ],
};

export const updateGitCheckCases = {
  positive: [
    positive("Git tag and real CLI check", ["v2.0.0", "2.0.0"], true),
    positive("unprefixed Git tag", ["1.1.0", "1.1.0"], true),
  ],
  negative: [
    rejected("older remote release", ["0.9.0", null], true),
    rejected("remote tag without a version", ["release-candidate", null], true),
  ],
};
