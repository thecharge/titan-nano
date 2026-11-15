import { ErrorCode } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const serverReaderContentionCases = {
  positive: [
    positive("brief schema reader releases before claim deadline", [20], {
      ready: true,
      code: null,
    }),
    positive("longer schema reader releases before claim deadline", [80], {
      ready: true,
      code: null,
    }),
  ],
  negative: [
    rejected("retained reader cannot grant exclusive ownership", [450], {
      ready: false,
      code: ErrorCode.ServerLocked,
    }),
    rejected("long retained reader cannot bypass claim deadline", [650], {
      ready: false,
      code: ErrorCode.ServerLocked,
    }),
  ],
};
