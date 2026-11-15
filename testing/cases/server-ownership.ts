import { negative, positive, rejected } from "@titan/test-factories";

export const serverOwnershipCases = {
  positive: [
    positive("a released kernel lease permits recovery after PID reuse", ["reused-pid"], {
      status: 200,
      addressRenewed: true,
    }),
    positive(
      "reused owner PID cannot retain stale discovery after lease recovery",
      ["reused-pid-again"],
      {
        status: 200,
        addressRenewed: true,
      },
    ),
    positive("dead owner is reclaimed under the writer lease", ["dead"], {
      status: 200,
      addressRenewed: true,
    }),
    positive("stale discovery is replaced after reclaim", ["dead-again"], {
      status: 200,
      addressRenewed: true,
    }),
  ],
  negative: [
    negative("kernel lease survives removed metadata", ["held-lease"], { code: "server_locked" }),
    negative("a lease marker cannot bypass an occupied kernel lease", ["held-lease-marker"], {
      code: "server_locked",
    }),
    negative("an invalid lease marker cannot authorize recovery", ["invalid-marker"], {
      code: "server_locked",
    }),
    negative("live legacy owner is preserved", ["live"], { code: "server_locked" }),
    negative("missing legacy owner cannot be guessed stale", ["missing"], {
      code: "server_locked",
    }),
    negative("corrupt legacy owner cannot be guessed stale", ["corrupt"], {
      code: "server_locked",
    }),
    negative("unusable lease path fails closed", ["lease-path"], { code: "server_locked" }),
  ],
};

export const maintenanceOwnershipCases = {
  positive: [
    positive("released maintenance ownership can be acquired again", ["released"], true),
    positive(
      "maintenance excludes new startup while the existing server stays healthy",
      ["live"],
      true,
    ),
  ],
  negative: [
    rejected("another updater cannot enter an owned maintenance interval", ["updater"], true),
    rejected("new server cannot enter an owned maintenance interval", ["server"], true),
    rejected("unusable maintenance lease refuses startup", ["invalid"], true),
  ],
};

export const maintenanceProcessCases = {
  positive: [
    positive("normal updater exit releases both kernel leases", ["completed"], true),
    positive(
      "killed updater releases both kernel leases without deleting their files",
      ["killed"],
      true,
    ),
  ],
  negative: [
    rejected("another process cannot acquire an updater's maintenance lease", ["updater"], true),
    rejected("a server cannot start while another process owns maintenance", ["server"], true),
  ],
};

export const leasePathSafetyCases = {
  positive: [
    positive("maintenance creates a private regular lease", [false, false], true),
    positive("offline ownership creates a private regular lease", [true, false], true),
  ],
  negative: [
    rejected("maintenance rejects a linked lease without changing its target", [false, true], true),
    rejected(
      "offline ownership rejects a linked lease without changing its target",
      [true, true],
      true,
    ),
    rejected("maintenance rejects a multiply linked lease", [false, true, true], true),
    rejected("offline ownership rejects a multiply linked lease", [true, true, true], true),
    rejected("maintenance rejects a linked journal companion", [false, true, false, true], true),
    rejected(
      "offline ownership rejects a linked journal companion",
      [true, true, false, true],
      true,
    ),
    rejected("maintenance rejects a multiply linked journal", [false, true, true, true], true),
    rejected("offline ownership rejects a multiply linked journal", [true, true, true, true], true),
  ],
};
