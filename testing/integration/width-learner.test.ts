import { WidthFixture } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { widthShareCases } from "../cases/width-learner.ts";
import { widthSmallShare } from "../factories/width-learner.ts";

unit(widthSmallShare, widthShareCases, WidthFixture.Timeout);
