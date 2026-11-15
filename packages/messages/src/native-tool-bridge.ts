export const NativeToolBridgeMessage = {
  Invalid: "Native tool connection settings are absent or invalid.",
  Startup: "The native tool server could not verify its active scope and tools.",
  Denied: "This native tool is outside the bound role policy.",
  Output: "The native tool output pipe is unavailable or did not accept the frame in time.",
  Command: "Serve tools for one host-authorized native execution over standard input and output.",
} as const;
