import { positive, rejected } from "@titan/test-factories";

export const personaMergeProcessCases = {
  positive: [
    positive("identical roles share their embedding and retain distinct versions", ["same"], true),
    positive("completed production runs offer similar persona roles once", ["match"], true),
    positive("the exact merge score boundary creates a durable offer", ["boundary"], true),
  ],
  negative: [
    rejected("an oversized merge offer batch refuses journal completion", ["capacity"], true),
    rejected("overflowing role vector norms refuse journal completion", ["overflow"], true),
    rejected("below-threshold role similarity creates no merge offer", ["under"], true),
    rejected("retired personas remain outside merge comparison", ["retired"], true),
    rejected("an unavailable optional model creates no invented offer", ["unavailable"], true),
    rejected("incompatible role vectors refuse journal completion", ["dimensions"], true),
    rejected("zero role vectors refuse journal completion", ["zero"], true),
  ],
};
