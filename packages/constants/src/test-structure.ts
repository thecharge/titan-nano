export const FlatTestRule = {
  File: /[._](?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/,
  MaximumFiles: 1024,
  MaximumBytes: 67_108_864,
} as const;

const tiers = ["testing/unit", "testing/integration", "testing/e2e"] as const;

export const TestLayout = {
  TierDirectories: tiers,
  TierPrefixes: tiers.map((directory) => `${directory}/`),
  ProductHelpers:
    /^(?:(?:apps|packages)\/[^/]+|tooling)(?:\/[^/]+)*\/(?:test|tests|testing|fixtures|factories|harness|stubs)\//,
} as const;
