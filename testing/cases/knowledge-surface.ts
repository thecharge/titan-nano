import { KnowledgeKind, KnowledgeTransport } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const knowledgeSurfaceCases = {
  positive: [
    positive(
      "HTTP fact keeps history across restart",
      [KnowledgeTransport.Http, KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "HTTP plan remains searchable by kind",
      [KnowledgeTransport.Http, KnowledgeKind.Plan, false],
      true,
    ),
    positive(
      "CLI fact keeps history across restart",
      [KnowledgeTransport.Cli, KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "CLI plan remains searchable by kind",
      [KnowledgeTransport.Cli, KnowledgeKind.Plan, false],
      true,
    ),
    positive(
      "MCP fact keeps history across restart",
      [KnowledgeTransport.Mcp, KnowledgeKind.Fact, false],
      true,
    ),
    positive(
      "MCP plan remains searchable by kind",
      [KnowledgeTransport.Mcp, KnowledgeKind.Plan, false],
      true,
    ),
  ],
  negative: [
    rejected(
      "HTTP deleted fact stays absent",
      [KnowledgeTransport.Http, KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "HTTP deleted lesson stays absent",
      [KnowledgeTransport.Http, KnowledgeKind.Lesson, true],
      true,
    ),
    rejected(
      "CLI deleted fact stays absent",
      [KnowledgeTransport.Cli, KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "CLI deleted lesson stays absent",
      [KnowledgeTransport.Cli, KnowledgeKind.Lesson, true],
      true,
    ),
    rejected(
      "MCP deleted fact stays absent",
      [KnowledgeTransport.Mcp, KnowledgeKind.Fact, true],
      true,
    ),
    rejected(
      "MCP deleted lesson stays absent",
      [KnowledgeTransport.Mcp, KnowledgeKind.Lesson, true],
      true,
    ),
  ],
};
