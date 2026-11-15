import { unit } from "@titan/test-factories";
import { streamDescriptorCases } from "../cases/stream-descriptors.ts";
import { streamDescriptors } from "../factories/stream-descriptors.ts";

unit(streamDescriptors, streamDescriptorCases);
