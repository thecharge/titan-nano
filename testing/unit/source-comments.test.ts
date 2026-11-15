import { unit } from "@titan/test-factories";
import { inspectSourceComments } from "../../tooling/scripts/check-source-comments.ts";
import {
  sourceCommentDiscoveryCases,
  sourceCommentSyntaxCases,
  sourceCommentTreeCases,
} from "../cases/source-comments.ts";
import { sourceCommentDiscovery, sourceCommentTree } from "../factories/source-comments.ts";

unit(inspectSourceComments, sourceCommentSyntaxCases);
unit(sourceCommentTree, sourceCommentTreeCases);
unit(sourceCommentDiscovery, sourceCommentDiscoveryCases);
