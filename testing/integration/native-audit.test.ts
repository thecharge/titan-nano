import { unit } from "@titan/test-factories";
import {
  nativeAuditCompletionCases,
  nativeAuditMetadataCases,
  nativeAuditProtocolCases,
  nativeAuditRefusalCases,
  nativeAuditScopeCases,
  nativeSplitAuditCases,
  nativeSplitCompletionCases,
} from "../cases/native-audit.ts";
import { nativeAuditCompletion } from "../factories/native-audit-completion.ts";
import { nativeAuditMetadata, nativeAuditRefusal } from "../factories/native-audit-metadata.ts";
import { nativeAuditProtocol } from "../factories/native-audit-protocol.ts";
import { nativeAuditScope } from "../factories/native-audit-scope.ts";

unit(nativeAuditMetadata, nativeAuditMetadataCases);
unit(nativeAuditRefusal, nativeAuditRefusalCases);
unit(nativeAuditScope, nativeAuditScopeCases);
unit(nativeAuditCompletion, nativeAuditCompletionCases);
unit(nativeAuditProtocol, nativeAuditProtocolCases);

unit(nativeAuditScope, nativeSplitAuditCases);

unit(nativeAuditCompletion, nativeSplitCompletionCases);
