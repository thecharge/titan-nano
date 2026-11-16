export const ScriptSandboxMessage = {
  Missing: "The script sandbox is unavailable. Reinstall Titan to prepare its pinned sandbox.",
  Unsafe: "The script scope contains a linked, protected or unsafe path.",
  Capacity: "The script scope exceeds the bounded sandbox policy budget.",
  Unsupported: "Scoped script execution requires Linux or macOS.",
  Build:
    "Preparing the pinned Linux script sandbox. The first source build needs a C compiler and libseccomp 2.5 or newer. Rust is installed in Titan's private dependency cache when needed.",
  Download: "The pinned script sandbox source download failed its checksum or HTTP check.",
  PrepareFailed:
    "Could not prepare the script sandbox. Check the build output and retry installation.",
} as const;
