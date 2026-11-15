import { unit } from "@titan/test-factories";
import {
  documentLinkEncodingCases,
  documentLinkResolvedTargetCases,
  documentLinkSnapshotCases,
  documentLinkSourceCases,
  documentLinkTreeCases,
} from "../cases/document-links.ts";
import {
  documentLinkEncoding,
  documentLinkResolvedTarget,
  documentLinkSnapshot,
  documentLinkSourceLink,
  documentLinkTree,
} from "../factories/document-links.ts";

unit(documentLinkTree, documentLinkTreeCases);
unit(documentLinkResolvedTarget, documentLinkResolvedTargetCases);
unit(documentLinkSourceLink, documentLinkSourceCases);
unit(documentLinkEncoding, documentLinkEncodingCases);

unit(documentLinkSnapshot, documentLinkSnapshotCases);
