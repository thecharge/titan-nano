import { positive, rejected } from "@titan/test-factories";

export const streamDescriptorCases = {
  positive: [
    positive("empty workspace reads release every descriptor", [false, false, false, true], 0),
    positive("empty journal reads release every descriptor", [true, false, false, true], 0),
    positive("completed workspace reads release every descriptor", [false], 0),
    positive("completed journal reads release every descriptor", [true], 0),
  ],
  negative: [
    rejected("early workspace return releases every descriptor", [false, true], 0),
    rejected("early journal return releases every descriptor", [true, true], 0),
    rejected("workspace consumer failure releases every descriptor", [false, false, true], 0),
    rejected("journal consumer failure releases every descriptor", [true, false, true], 0),
  ],
};
