import { unit } from "@titan/test-factories";
import {
  offlineDriverOutputCases,
  offlineSelectionCases,
  offlineSelectionProcessCases,
} from "../cases/offline-selection.ts";
import {
  offlineDriverOutput,
  offlineSelection,
  offlineSelectionProcess,
} from "../factories/offline-selection.ts";

unit(offlineSelection, offlineSelectionCases);

unit(offlineSelectionProcess, offlineSelectionProcessCases);

unit(offlineDriverOutput, offlineDriverOutputCases);
