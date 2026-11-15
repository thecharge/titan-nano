import { unit } from "@titan/test-factories";
import { personaDeleteCases } from "../cases/persona-lifecycle.ts";
import { personaDelete } from "../factories/persona-lifecycle.ts";

unit(personaDelete, personaDeleteCases);
