import { unit } from "@titan/test-factories";
import {
  daemonClientsCases,
  daemonEntryCases,
  daemonProbeCases,
  daemonStartupCases,
  runtimeBuildIdentityCases,
} from "../cases/daemon.ts";
import { daemonStartup } from "../factories/daemon.ts";
import { daemonClients } from "../factories/daemon-clients.ts";
import { daemonEntryPath, daemonProbe, runtimeBuildIdentity } from "../factories/daemon-probe.ts";

unit(daemonStartup, daemonStartupCases);
unit(daemonProbe, daemonProbeCases);
unit(daemonEntryPath, daemonEntryCases);

unit(daemonClients, daemonClientsCases);

unit(runtimeBuildIdentity, runtimeBuildIdentityCases);
