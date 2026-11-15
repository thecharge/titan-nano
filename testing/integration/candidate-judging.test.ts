import { unit } from "@titan/test-factories";
import {
  judgePicksBCases,
  noCandidateSurvivesCases,
  oneCandidateSurvivesCases,
  threeCandidatesTwoSurviveCases,
} from "../cases/candidate-judging.ts";
import {
  judgePicks,
  noCandidateSurvives,
  oneCandidateSurvives,
  threeCandidatesTwoSurvive,
} from "../factories/candidate-judging.ts";

unit(threeCandidatesTwoSurvive, threeCandidatesTwoSurviveCases);
unit(oneCandidateSurvives, oneCandidateSurvivesCases);
unit(noCandidateSurvives, noCandidateSurvivesCases);
unit(judgePicks, judgePicksBCases);
