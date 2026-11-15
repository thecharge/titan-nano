import { unit } from "@titan/test-factories";
import {
  readClaimNegotiationCases,
  readClaimPersistenceCases,
  readClaimRevisionCases,
} from "../cases/read-claims.ts";
import {
  writeClaimGrantCases,
  writeClaimNegotiationCases,
  writeClaimParentCases,
  writeClaimPersistenceCases,
  writeClaimServerCases,
} from "../cases/write-claims.ts";
import {
  readClaimNegotiation,
  readClaimPersistence,
  readClaimRevision,
} from "../factories/read-claims.ts";
import {
  writeClaimGrant,
  writeClaimNegotiation,
  writeClaimParent,
  writeClaimPersistence,
  writeClaimServer,
} from "../factories/write-claims.ts";

unit(readClaimRevision, readClaimRevisionCases);
unit(readClaimNegotiation, readClaimNegotiationCases);
unit(readClaimPersistence, readClaimPersistenceCases);
unit(writeClaimGrant, writeClaimGrantCases);
unit(writeClaimNegotiation, writeClaimNegotiationCases);
unit(writeClaimPersistence, writeClaimPersistenceCases);
unit(writeClaimServer, writeClaimServerCases);
unit(writeClaimParent, writeClaimParentCases);
