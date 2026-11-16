import { unit } from "@titan/test-factories";
import { nativeShellBoundaryCases, nativeShellSdkCases } from "../cases/native-shell.ts";
import { nativeShellBoundary, nativeShellSdk } from "../factories/native-shell.ts";

unit(nativeShellBoundary, nativeShellBoundaryCases);
unit(nativeShellSdk, nativeShellSdkCases);
