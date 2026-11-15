import { unit } from "@titan/test-factories";
import {
  openCallAnsweredCases,
  openCallIndependentCheckerCases,
  openCallLargeRegisterCases,
  openCallMissCases,
  openCallResolverBoundaryCases,
  openCallResumeCases,
  openCallTamperCases,
  programOpenCallCases,
  registeredOpenCallDocumentCases,
  serverOpenCallCases,
} from "../cases/open-call.ts";
import {
  openCallIndependentChecker,
  openCallLargeRegister,
  openCallResolverBoundary,
  openCallResume,
  openCallScenario,
  openCallTamper,
  programOpenCall,
  registeredOpenCallDocument,
  serverOpenCall,
} from "../factories/open-call.ts";

unit(openCallScenario, openCallAnsweredCases);
unit(openCallScenario, openCallMissCases);
unit(openCallResume, openCallResumeCases);
unit(openCallTamper, openCallTamperCases);
unit(serverOpenCall, serverOpenCallCases);
unit(programOpenCall, programOpenCallCases);
unit(registeredOpenCallDocument, registeredOpenCallDocumentCases);

unit(openCallIndependentChecker, openCallIndependentCheckerCases);

unit(openCallResolverBoundary, openCallResolverBoundaryCases);

unit(openCallLargeRegister, openCallLargeRegisterCases);
