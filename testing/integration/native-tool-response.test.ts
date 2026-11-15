import { unit } from "@titan/test-factories";
import { nativeStdioOutputCases, nativeToolResponseCases } from "../cases/native-tool-response.ts";
import { nativeStdioOutput, nativeToolResponse } from "../factories/native-tool-response.ts";

unit(nativeToolResponse, nativeToolResponseCases);
unit(nativeStdioOutput, nativeStdioOutputCases);
