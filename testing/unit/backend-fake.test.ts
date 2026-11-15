import { unit } from "@titan/test-factories";
import {
  configuredFakeScriptCases,
  fakeCancellationCases,
  fakeScriptAdmissionCases,
  fakeScriptPromptCases,
  personaInvocationCases,
  processObservationCases,
  scriptedFakeCases,
} from "../cases/backend.ts";
import {
  configuredFakeScript,
  fakeCancellation,
  fakeScriptAdmission,
  fakeScriptPrompt,
  personaInvocation,
  processObservation,
  scriptedFake,
} from "../factories/backend.ts";

unit(fakeCancellation, fakeCancellationCases);

unit(processObservation, processObservationCases);

unit(scriptedFake, scriptedFakeCases);
unit(fakeScriptAdmission, fakeScriptAdmissionCases);
unit(fakeScriptPrompt, fakeScriptPromptCases);

unit(configuredFakeScript, configuredFakeScriptCases);
unit(personaInvocation, personaInvocationCases);
