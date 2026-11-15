import { unit } from "@titan/test-factories";
import {
  codexContinuationCases,
  codexIdentityCases,
  codexIsolationCases,
  codexRecoveryCases,
  codexTransportCases,
} from "../cases/codex-transport.ts";
import {
  codexContinuation,
  codexIdentity,
  codexIsolation,
  codexRecovery,
  codexTransport,
} from "../factories/codex-transport.ts";

unit(codexTransport, codexTransportCases);

unit(codexIsolation, codexIsolationCases);

unit(codexContinuation, codexContinuationCases);

unit(codexRecovery, codexRecoveryCases);

unit(codexIdentity, codexIdentityCases);
