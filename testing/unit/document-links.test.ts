import { unit } from "@titan/test-factories";
import { documentLinkSyntaxCases } from "../cases/document-links.ts";
import { documentLinks } from "../factories/document-links.ts";

unit(documentLinks, documentLinkSyntaxCases);
