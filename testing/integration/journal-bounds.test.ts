import { unit } from "@titan/test-factories";
import { journalBoundCases } from "../cases/journal-bounds.ts";
import { journalBounds } from "../factories/journal-bounds.ts";

unit(journalBounds, journalBoundCases);
