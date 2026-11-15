import { unit } from "@titan/test-factories";
import {
  flatTestDiscoveryCases,
  flatTestSyntaxCases,
  flatTestTreeCases,
  testLayoutCases,
} from "../cases/flat-tests.ts";
import { flatTestDiscovery, flatTestSyntax, flatTestTree } from "../factories/flat-tests.ts";

unit(flatTestSyntax, flatTestSyntaxCases);
unit(flatTestTree, flatTestTreeCases);
unit(flatTestDiscovery, flatTestDiscoveryCases);

unit(flatTestTree, testLayoutCases);
