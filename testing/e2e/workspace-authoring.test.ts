import { unit } from "@titan/test-factories";
import {
  personaCreationCases,
  scopedPersonaDeliveryCases,
  workflowCreationCases,
  workspaceSkillInspectionCases,
  workspaceSnapshotSelectionCases,
} from "../cases/workspace-authoring.ts";
import { scopedPersonaDelivery } from "../factories/scoped-persona-delivery.ts";
import {
  personaCreation,
  workflowCreation,
  workspaceSkillInspection,
  workspaceSnapshotSelection,
} from "../factories/workspace-authoring.ts";

unit(workflowCreation, workflowCreationCases);
unit(personaCreation, personaCreationCases);
unit(scopedPersonaDelivery, scopedPersonaDeliveryCases);

unit(workspaceSkillInspection, workspaceSkillInspectionCases);

unit(workspaceSnapshotSelection, workspaceSnapshotSelectionCases);
