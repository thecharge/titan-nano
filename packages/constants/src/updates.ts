export enum UpdateCheck {
  Daily = "daily",
  Never = "never",
}

export enum UpdateMode {
  Notify = "notify",
  Auto = "auto",
  Off = "off",
}

export enum UpdateBackupStage {
  Copied = "copied",
  Verified = "verified",
}

export enum UpdatePhase {
  Preparing = "preparing",
  BackedUp = "backed_up",
  Installed = "installed",
  Verified = "verified",
  Switched = "switched",
  Complete = "complete",
  RolledBack = "rolled_back",
}

export const UpdateFile = {
  BootstrapBoth: "both",
  Backups: "backups",
  Manifest: "manifest.json",
  Home: "home",
  Projects: "projects",
  TemporaryPrefix: ".titan-backup-",
  CatalogPrefix: "titan-update-catalog-",
  Transaction: "update-transaction.json",
  Launcher: "titan",
  CommandOwnership: ".titan-command-link.json",
  ReadLease: "SELECT name FROM sqlite_master LIMIT 1",
  UnsafeWriteMode: 0o022,
  Separator: "-",
  NextLauncher: ".update-launcher-",
  PrivateManifest: '{"private":true}',
  IgnoreScripts: "--ignore-scripts",
  PackageMilliseconds: 120000,
  CopyPattern: /^(?:home|projects\/[1-9]\d*)$/,
  LauncherPattern: /^releases\/titan-cli-[^/]+\/node_modules\/\.bin\/titan$/,
  SourcePrefix: ".update-source-",
  Workspace: "titan-workspace",
  Clone: ["clone", "--depth=1", "--branch"],
  FrozenInstall: ["install", "--frozen-lockfile", "--ignore-scripts"],
  TagReferencePrefix: "refs/tags/",
  RefPrefixPattern: /^[^\t]+\trefs\/tags\//,
  FieldSeparator: "\t",
  RevParse: "rev-parse",
  EndOptions: "--",
  PinnedRuntime: "TITAN_PINNED_RUNTIME",
  BootstrapPrefix: ".install-launcher-",
  BootstrapBuildPrefix: "titan-install-build-",
} as const;

export const UpdatePolicy = {
  TimeoutMilliseconds: 1800,
  DayMilliseconds: 24 * 60 * 60 * 1000,
  OutputBytes: 1024 * 1024,
  MaximumTags: 10000,
  VersionCharacters: 256,
  CacheFile: "update-check.json",
  Git: "git",
  Arguments: ["ls-remote", "--tags", "--refs", "--"],
  TagPattern:
    /^[0-9a-f]{40,64}\trefs\/tags\/v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?(?:\+[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/,
  VersionPattern:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?(?:\+[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/,
  SourcePattern: /^(?!-)(?!\s*$)[^\p{Cc}]+$/u,
  Zero: "0",
  NumericPattern: /^\d+$/,
  TagPrefixPattern: /^[^\t]+\trefs\/tags\/v?/,
} as const;
