import { unit } from "@titan/test-factories";
import {
  knowledgeRunnerArtifactCases,
  knowledgeRunnerRecoveryCases,
} from "../cases/knowledge-runner-recovery.ts";
import {
  knowledgeRunnerArtifact,
  knowledgeRunnerRecovery,
} from "../factories/knowledge-runner-recovery.ts";

unit(knowledgeRunnerRecovery, knowledgeRunnerRecoveryCases);

unit(knowledgeRunnerArtifact, knowledgeRunnerArtifactCases);
