import { positive, rejected } from "@titan/test-factories";

export const sealedCaptureRecoveryCases = {
  positive: [
    positive(
      "completed native work reconciles external changes with fresh checks",
      [false, "live", false, true],
      true,
    ),
    positive(
      "completed worker reconciliation admission survives restart",
      [false, "live-restart", false, true],
      true,
    ),
    positive(
      "sealed native work reconciles an external edit through fresh checks",
      [false, "live"],
      true,
    ),
    positive("sealed reconciliation admission survives restart", [false, "live-restart"], true),
    positive(
      "split aggregate seal resumes with fresh checks and no part dispatch",
      [false, null, true],
      true,
    ),
    positive(
      "native sealed receipt resumes with fresh checks and no worker dispatch",
      [false, null],
      true,
    ),
    positive(
      "script sealed receipt resumes with fresh checks and no command repeat",
      [true, null],
      true,
    ),
  ],
  negative: [
    rejected(
      "changed completed worker evidence blocks reconciliation after restart",
      [false, "archive", false, true],
      true,
    ),
    rejected(
      "missing completed worker seal blocks reconciliation after restart",
      [false, "archive-manifest", false, true],
      true,
    ),
    rejected("changed archived candidate blocks a sealed reconciliation", [false, "archive"], true),
    rejected(
      "missing archived seal blocks a sealed reconciliation",
      [false, "archive-manifest"],
      true,
    ),
    rejected(
      "changed live files cannot complete a sealed split aggregate",
      [false, "live", true],
      true,
    ),
    rejected(
      "changed captured evidence cannot complete a sealed native receipt",
      [false, "candidate"],
      true,
    ),
    rejected("changed live files cannot complete a sealed script receipt", [true, "live"], true),
    rejected(
      "missing capture manifest cannot complete a sealed receipt",
      [false, "manifest"],
      true,
    ),
  ],
};

export const captureRecoveryCases = {
  positive: [
    positive(
      "split worker retains a captured aggregate receipt",
      [false, false, false, true],
      true,
    ),
    positive("native worker publishes its captured receipt once", [false, false], true),
    positive("script worker publishes its captured receipt once", [true, false], true),
  ],
  negative: [
    rejected(
      "split checkpoint failure cannot adopt later edits after restart",
      [false, true, false, true],
      true,
    ),
    rejected(
      "native cleanup failure retains its received answer before restart",
      [false, true, true],
      true,
    ),
    rejected(
      "native checkpoint failure cannot repeat side effects after restart",
      [false, true],
      true,
    ),
    rejected(
      "script checkpoint failure cannot adopt later edits or repeat execution",
      [true, true],
      true,
    ),
  ],
};
