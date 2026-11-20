import { unit } from "@titan/test-factories";
import {
  webResourceCases,
  webResourceCliCases,
  webResourceDialCases,
  webResourceNativeCases,
} from "../cases/web-resource.ts";
import { resourceResponse, webResourceCli, webResourceDial } from "../factories/web-resource.ts";
import { webResourceNative } from "../factories/web-resource-native.ts";

unit(resourceResponse, webResourceCases);
unit(webResourceCli, webResourceCliCases);
unit(webResourceDial, webResourceDialCases);
unit(webResourceNative, webResourceNativeCases);
