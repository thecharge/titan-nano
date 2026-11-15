import type { DocumentLinkTarget } from "../document-links.ts";

export type DocumentLinkLoader = (path: string) => Promise<DocumentLinkTarget>;
