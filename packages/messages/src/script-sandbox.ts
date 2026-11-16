export const ScriptSandboxMessage = {
  Missing: "The script sandbox is unavailable. Reinstall Titan to prepare its pinned sandbox.",
  Unsafe: "The script scope contains a linked, protected or unsafe path.",
  Capacity: "The script scope exceeds the bounded sandbox policy budget.",
  Unsupported: "Scoped script execution requires Linux or macOS.",
  Build:
    "Preparing the pinned Linux script sandbox. The first source build needs a C compiler, patch and Linux 6.12 or newer. Rust is installed in Titan's private dependency cache when needed.",
  Distribution:
    "The script sandbox component inventory or distribution is incomplete or contains a rejected helper.",
  Download: "The pinned script sandbox source download failed its checksum or HTTP check.",
  PrepareFailed:
    "Could not prepare the script sandbox. Check the build output and retry installation.",
} as const;
