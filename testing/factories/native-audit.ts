import {
  type NativeToolAuditRecord,
  NativeToolAuditSchema,
  type NativeToolScope,
  NativeToolScopeSchema,
} from "@titan/types";

export function acceptNativeAudit(scope: NativeToolScope, record: NativeToolAuditRecord) {
  NativeToolScopeSchema.parse(scope);
  NativeToolAuditSchema.parse(record);
  return Promise.resolve();
}
