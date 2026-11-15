import { unit } from "@titan/test-factories";
import {
  backendForCases,
  bundledSdkLookupCases,
  doctorCases,
  harnessDetectionCases,
  sdkLookupCases,
} from "../cases/harness-detection.ts";
import {
  backendFor,
  bundledSdkLookup,
  doctorHarness,
  harnessDetection,
  sdkLookup,
} from "../factories/harness-detection.ts";

unit(harnessDetection, harnessDetectionCases);
unit(doctorHarness, doctorCases);
unit(sdkLookup, sdkLookupCases);
unit(bundledSdkLookup, bundledSdkLookupCases);
unit(backendFor, backendForCases);
