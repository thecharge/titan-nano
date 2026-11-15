import { unit } from "@titan/test-factories";
import { personaDefinitionCases } from "../cases/persona-definition.ts";
import { personaDefinition } from "../factories/persona-definition.ts";

unit(personaDefinition, personaDefinitionCases);
