import { unit } from "@titan/test-factories";
import {
  runHubFinalizationCases,
  runHubRecordCases,
  runHubStartCases,
  runHubToolsCases,
} from "../cases/run-hub.ts";
import {
  runHubFinalization,
  runHubRecord,
  runHubStart,
  runHubTools,
} from "../factories/run-hub.ts";

unit(runHubRecord, runHubRecordCases);
unit(runHubTools, runHubToolsCases);
unit(runHubStart, runHubStartCases);

unit(runHubFinalization, runHubFinalizationCases);
