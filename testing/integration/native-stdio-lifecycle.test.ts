import { unit } from "@titan/test-factories";
import { nativeStdioLifecycleCases } from "../cases/native-stdio-lifecycle.ts";
import { nativeStdioLifecycle } from "../factories/native-stdio-lifecycle.ts";

unit(nativeStdioLifecycle, nativeStdioLifecycleCases);
