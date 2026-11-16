import { unit } from "@titan/test-factories";
import {
  nativeFileGrantCases,
  nativeManagedSdkWriteCases,
  nativeManagedWriteCases,
  nativeWorkspaceWriteCases,
} from "../cases/native-write.ts";
import {
  nativeFileGrants,
  nativeManagedSdkWrite,
  nativeManagedWrite,
  nativeWorkspaceWrite,
} from "../factories/native-write.ts";

unit(nativeManagedWrite, nativeManagedWriteCases);
unit(nativeFileGrants, nativeFileGrantCases);
unit(nativeManagedSdkWrite, nativeManagedSdkWriteCases);
unit(nativeWorkspaceWrite, nativeWorkspaceWriteCases);
