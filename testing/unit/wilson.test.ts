import { unit } from "@titan/test-factories";
import {
  wilsonExampleCases,
  wilsonPairCases,
  wilsonPropertyCases,
  wilsonWidthPropertyCases,
} from "../cases/wilson.ts";
import {
  wilsonExample,
  wilsonPair,
  wilsonProperty,
  wilsonWidthProperty,
} from "../factories/wilson.ts";

unit(wilsonExample, wilsonExampleCases);
unit(wilsonPair, wilsonPairCases);
unit(wilsonProperty, wilsonPropertyCases);
unit(wilsonWidthProperty, wilsonWidthPropertyCases);
