import { unit } from "@titan/test-factories";
import { nativeExecutionOwnerCases } from "../cases/native-execution-owner.ts";
import { nativeExecutionOwner } from "../factories/native-execution-owner.ts";

unit(nativeExecutionOwner, nativeExecutionOwnerCases);
