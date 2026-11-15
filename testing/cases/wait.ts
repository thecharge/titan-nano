import { positive, rejected } from "@titan/test-factories";

export const waitObservationCases = {
  positive: [
    positive("ready evidence returns without another observation", [1, 3, 40], true),
    positive("delayed evidence uses the selected observation interval", [3, 4, 40], true),
  ],
  negative: [
    rejected("absent evidence stops after its observation budget", [4, 2, 40], false),
    rejected("an empty observation budget cannot claim readiness", [1, 0, 40], false),
  ],
};
