import { unit } from "@titan/test-factories";
import {
  personaBindingRetryCases,
  personaConcurrentSubmissionsCases,
  personaDefinitionUpdateCases,
  personaEntryCases,
  personaFromRunCases,
  personaHomeCases,
  personaMutateCases,
  personaMutationInheritanceCases,
  personaOpenCases,
  personaRegisterBrokenCases,
  personaRegisterUseCases,
  personaRegistryIdentityCases,
  personaRegistryOwnerCases,
  personaRegistryRecoveryCases,
  personaResolvedRunCases,
  personaShowCases,
  personaShowPageCases,
  personaUseCases,
} from "../cases/persona-register.ts";
import {
  personaBindingRetry,
  personaConcurrentSubmissions,
  personaDefinitionUpdate,
  personaEntry,
  personaFromRun,
  personaHome,
  personaMutate,
  personaMutationInheritance,
  personaOpen,
  personaRegisterBroken,
  personaRegisterUse,
  personaRegistryIdentity,
  personaRegistryOwner,
  personaRegistryRecovery,
  personaResolvedRun,
  personaShow,
  personaShowPage,
  personaUse,
} from "../factories/persona-register.ts";

unit(personaFromRun, personaFromRunCases);
unit(personaBindingRetry, personaBindingRetryCases);
unit(personaShow, personaShowCases);
unit(personaShowPage, personaShowPageCases);
unit(personaHome, personaHomeCases);
unit(personaMutate, personaMutateCases);
unit(personaMutationInheritance, personaMutationInheritanceCases);
unit(personaUse, personaUseCases);
unit(personaEntry, personaEntryCases);
unit(personaOpen, personaOpenCases);
unit(personaRegisterUse, personaRegisterUseCases);
unit(personaRegisterBroken, personaRegisterBrokenCases);

unit(personaRegistryOwner, personaRegistryOwnerCases);
unit(personaRegistryRecovery, personaRegistryRecoveryCases);

unit(personaResolvedRun, personaResolvedRunCases);

unit(personaRegistryIdentity, personaRegistryIdentityCases);

unit(personaConcurrentSubmissions, personaConcurrentSubmissionsCases);
unit(personaDefinitionUpdate, personaDefinitionUpdateCases);
