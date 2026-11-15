import { unit } from "@titan/test-factories";
import { scopedConfigShowCases } from "../cases/config-show.ts";
import { scopedConfigShow, scopedConfigShowProcess } from "../factories/config-show.ts";

unit(scopedConfigShow, scopedConfigShowCases);
unit(scopedConfigShowProcess, scopedConfigShowCases);
