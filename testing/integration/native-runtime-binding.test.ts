import { TestSchedule } from "@titan/constants";
import { unit } from "@titan/test-factories";
import { nativeRuntimeBindingCases } from "../cases/native-runtime-binding.ts";
import { nativeRuntimeBinding } from "../factories/native-runtime-binding.ts";

unit(nativeRuntimeBinding, nativeRuntimeBindingCases, undefined, TestSchedule.Concurrent);
