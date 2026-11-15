import { unit } from "@titan/test-factories";
import {
  commandCaptureArgumentCases,
  commandCaptureCases,
  commandCaptureOptionCases,
} from "../cases/command-capture.ts";
import {
  commandCapture,
  commandCaptureArguments,
  commandCaptureOptions,
} from "../factories/command-capture.ts";

unit(commandCapture, commandCaptureCases);
unit(commandCaptureArguments, commandCaptureArgumentCases);
unit(commandCaptureOptions, commandCaptureOptionCases);
