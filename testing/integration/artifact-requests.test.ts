import { unit } from "@titan/test-factories";
import { artifactRequestCases } from "../cases/artifact-requests.ts";
import { artifactAfterRequest } from "../factories/artifact-requests.ts";

unit(artifactAfterRequest, artifactRequestCases);
