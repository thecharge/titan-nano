import { positive, rejected } from "@titan/test-factories";

export const serverMaintenanceCases = {
  positive: [
    positive("home owner shuts down an idle server for maintenance", ["idle"], true),
    positive("omitted idle selector preserves the safe default", ["default"], true),
    positive(
      "explicit owner shutdown pauses active work before releasing storage",
      ["force"],
      true,
    ),
  ],
  negative: [
    rejected("cleanup failure remains observable and releases ownership", ["cleanup"], true),
    rejected("agent discovery credential cannot stop the server", ["agent"], true),
    rejected("automatic handoff refuses an active workflow", ["active"], true),
    rejected("shutdown requires its declared method", ["method"], true),
    rejected("malformed shutdown settings cannot close admission", ["body"], true),
    rejected("extra shutdown query cannot close admission", ["query"], true),
  ],
};

export const daemonMaintenanceCases = {
  positive: [
    positive("idle owner handoff exits the daemon cleanly", ["idle"], true),
    positive("explicit owner handoff permits a replacement daemon", ["explicit"], true),
  ],
  negative: [
    rejected("agent shutdown request keeps the daemon available", ["agent"], true),
    rejected("invalid owner shutdown request keeps the daemon available", ["body"], true),
  ],
};
