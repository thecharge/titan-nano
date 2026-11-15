import { unit } from "@titan/test-factories";
import {
  allFalsifiersSurviveCases,
  falsifierSessionCases,
  falsifierTaskCases,
  oneFalsifierRefutesCases,
  refutedWithoutEvidenceCases,
} from "../cases/step-falsification.ts";
import {
  allFalsifiersSurvive,
  falsifierIsolation,
  falsifierTask,
  oneFalsifierRefutes,
  refutedWithoutEvidence,
} from "../factories/step-falsification.ts";

unit(allFalsifiersSurvive, allFalsifiersSurviveCases);
unit(oneFalsifierRefutes, oneFalsifierRefutesCases);
unit(refutedWithoutEvidence, refutedWithoutEvidenceCases);
unit(falsifierTask, falsifierTaskCases);
unit(falsifierIsolation, falsifierSessionCases);
