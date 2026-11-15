import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import {
  configFileArgumentCases,
  configFileBoundaryCases,
  configFileConcurrencyCases,
  configFileEditCases,
  configFileLeaseCases,
  configFileReadCases,
} from "../cases/config-files.ts";
import {
  configConcurrentProcess,
  configFileArguments,
  configFileBoundary,
  configFileBoundaryProcess,
  configFileConcurrency,
  configFileEdit,
  configFileLease,
  configFileProcess,
  configFileRead,
} from "../factories/config-files.ts";

unit(configFileEdit, configFileEditCases, undefined, TestSchedule.Concurrent);
unit(configFileRead, configFileReadCases, undefined, TestSchedule.Concurrent);
unit(configFileConcurrency, configFileConcurrencyCases, undefined, TestSchedule.Concurrent);

unit(configFileLease, configFileLeaseCases, undefined, TestSchedule.Concurrent);
unit(configFileArguments, configFileArgumentCases, undefined, TestSchedule.Concurrent);

unit(configFileProcess, configFileEditCases, undefined, TestSchedule.Concurrent);

unit(configConcurrentProcess, configFileConcurrencyCases, undefined, TestSchedule.Concurrent);

unit(configFileBoundary, configFileBoundaryCases, undefined, TestSchedule.Concurrent);
unit(configFileBoundaryProcess, configFileBoundaryCases, undefined, TestSchedule.Concurrent);
