import { positive, rejected } from "@titan/test-factories";

export const proofReportIntegrityCases = {
  positive: [
    positive("kept script reports are committed with their delivery", ["kept"], true),
    positive("legacy answers expose their missing report history", ["legacy"], true),
    positive("complete checker output retains non-UTF8 bytes", ["binary"], true),
    positive("large repeated checker output stays outside run records", ["large"], true),
  ],
  negative: [
    rejected("discarded refutations stay outside kept proof totals", ["discarded"], true),
    rejected("combined proof history cannot exceed its byte budget", ["budget"], true),
    rejected("changed proof reports invalidate artifact inspection", ["changed"], true),
    rejected("missing proof reports invalidate artifact inspection", ["missing"], true),
    rejected("changed checker output invalidates artifact inspection", ["output-changed"], true),
    rejected("missing checker output invalidates artifact inspection", ["output-missing"], true),
    rejected("linked checker output parents invalidate inspection", ["output-linked"], true),
    rejected("changed retained capture invalidates inspection", ["capture-changed"], true),
    rejected("missing retained capture invalidates inspection", ["capture-missing"], true),
    rejected("linked retained capture invalidates inspection", ["capture-linked"], true),
  ],
};
