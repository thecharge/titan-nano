import { unit } from "@titan/test-factories";
import {
  catalogIsolationCases,
  listingResponseCases,
  startIsolationCases,
} from "../cases/listing.ts";
import { catalogIsolation, listingResponse, startIsolation } from "../factories/listing.ts";

unit(catalogIsolation, catalogIsolationCases);

unit(listingResponse, listingResponseCases);

unit(startIsolation, startIsolationCases);
