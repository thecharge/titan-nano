export const updateAvailable = (version: string): string =>
  `Titan ${version} is available. Run titan update --check.`;

export const updateBackupRetained = (message: string, backup: string): string =>
  `${message}. The verified update backup is retained at ${backup}`;

export const UpdateMessage = {
  Owner: "Release update settings belong to the home owner",
  CheckRequired:
    "Use titan update --check for release discovery or titan update --from FILE to install a release",
  Failed: "The release source could not be checked",
  BackupChanged: "Update backup verification found changed files",
  BackupPath: "Update backup roots must be real directories",
  BackupSpecial: "Update backup contains an unsupported special file",
  ManagedRequired: "Run updates through the managed Titan launcher created by install.sh",
  PackageRequired: "Select a local Titan release package with titan update --from FILE",
  LauncherChanged: "The managed launcher changed during the update",
  PackageFailed:
    "The staged Titan package failed installation or validation. The previous release remains selected",
  RecoveryRequired:
    "An interrupted update needs recovery. Run titan update through the managed launcher",
  TransactionChanged: "The update transaction or its verified backup changed",
  Downgrade: "The selected package must contain a newer Titan release",
  AutomaticFailed: "The automatic update failed. Run titan update to inspect and retry it",
  BootstrapArguments: "Choose an installation folder and a Titan source folder",
  BootstrapLauncher: "The installation launcher belongs to another file. Choose another folder",
  BootstrapReleases: "The release folder must be a real directory",
  BootstrapArchives: "The build must produce exactly one Titan package in dist/",
  BootstrapCommand: "The installation command failed",
  BootstrapInstalled: "Titan is installed in",
  BootstrapStart: "Start with",
  BootstrapPath: "Add the installation folder to PATH to use titan from any project",
  BootstrapLinked: "The titan command is linked at",
  BootstrapCommandExists: "An existing command was preserved at",
} as const;
