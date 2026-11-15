import { unit } from "@titan/test-factories";
import { credentialCases } from "../cases/credentials.ts";
import { credentialAccess } from "../factories/credentials.ts";

unit(credentialAccess, credentialCases);
