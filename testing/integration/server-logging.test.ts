import { unit } from "@titan/test-factories";
import {
  backgroundLogCases,
  loggerConfigurationCases,
  serverDiagnosticsCases,
} from "../cases/server-logging.ts";
import {
  backgroundLog,
  loggerConfiguration,
  serverDiagnostics,
} from "../factories/server-logging.ts";

unit(backgroundLog, backgroundLogCases);
unit(loggerConfiguration, loggerConfigurationCases);
unit(serverDiagnostics, serverDiagnosticsCases);
