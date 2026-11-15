import { positive, rejected } from "@titan/test-factories";

export const dashboardKnowledgeCases = {
  positive: [
    positive("pending project changes show exact attempt provenance", ["pending"], true),
    positive("scope and kind filters match committed project lessons", ["scope"], true),
    positive("tag selection restricts committed entries", ["tag"], true),
    positive("home entry keeps its home provenance", ["home-entry"], true),
    positive("home scope on a known run keeps home provenance", ["home-scope-entry"], true),
    positive("home overview lists committed shared entries", ["home"], true),
    positive("known run lists project and home scopes", ["project"], true),
    positive("entry inspection shows project content and provenance", ["entry"], true),
  ],
  negative: [
    rejected("pending selector cannot present a final entry body", ["pending-entry"], true),
    rejected("home pending filter excludes project private changes", ["pending-home"], true),
    rejected("invalid pending state is a client error", ["invalid-state"], true),
    rejected("invalid scope is a client error", ["invalid"], true),
    rejected("arbitrary project path field is refused", ["unknown-field"], true),
    rejected("missing tag produces no committed entries", ["missing-tag"], true),
    rejected("foreign origin cannot inspect knowledge", ["origin"], true),
    rejected("missing cookie cannot inspect knowledge", ["cookie"], true),
    rejected("knowledge endpoint refuses POST", ["post"], true),
    rejected("duplicate run selectors are refused", ["duplicate"], true),
    rejected("unknown run cannot select arbitrary project files", ["unknown"], true),
  ],
};
