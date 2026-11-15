import { unit } from "@titan/test-factories";
import {
  eventInspectionCases,
  eventResponseCases,
  eventSearchCases,
  journalPageCases,
} from "../cases/events.ts";
import { eventInspection, eventResponse, eventSearch, journalPage } from "../factories/events.ts";

unit(journalPage, journalPageCases);
unit(eventInspection, eventInspectionCases);

unit(eventSearch, eventSearchCases);

unit(eventResponse, eventResponseCases);
