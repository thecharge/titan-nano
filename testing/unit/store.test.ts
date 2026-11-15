import { unit } from "@titan/test-factories";
import { entryCases, expiryCases, queueCases, storeCases, updateCases } from "../cases/store.ts";
import {
  observedExpiry,
  observedQueue,
  observedStore,
  observedUpdate,
  parsedStoreEntry,
} from "../factories/store.ts";

unit(observedStore, storeCases);
unit(observedQueue, queueCases);
unit(observedExpiry, expiryCases);
unit(observedUpdate, updateCases);
unit(parsedStoreEntry, entryCases);
