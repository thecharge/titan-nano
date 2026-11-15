import { unit } from "@titan/test-factories";
import {
  candidateCommitmentPhaseCases,
  candidateCommitmentPublicationCases,
  candidateCommitmentRecoveryCases,
} from "../cases/candidate-commitment.ts";
import {
  candidateCommitmentPhase,
  candidateCommitmentPublication,
  candidateCommitmentRecovery,
} from "../factories/candidate-commitment.ts";

unit(candidateCommitmentRecovery, candidateCommitmentRecoveryCases);

unit(candidateCommitmentPhase, candidateCommitmentPhaseCases);

unit(candidateCommitmentPublication, candidateCommitmentPublicationCases);
