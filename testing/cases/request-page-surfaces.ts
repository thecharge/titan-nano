import { RequestPageSurface, RequestPageTransport } from "@titan/constants";
import { positive, rejected } from "@titan/test-factories";

export const requestPageSurfaceCases = {
  positive: [
    positive(
      "HTTP selects one session's two runs",
      [RequestPageTransport.Http, RequestPageSurface.Sessions],
      true,
    ),
    positive(
      "CLI selects one session's two runs",
      [RequestPageTransport.Cli, RequestPageSurface.Sessions],
      true,
    ),
    positive(
      "MCP selects one session's two runs",
      [RequestPageTransport.Mcp, RequestPageSurface.Sessions],
      true,
    ),
    positive(
      "HTTP intersects project and client",
      [RequestPageTransport.Http, RequestPageSurface.Project],
      true,
    ),
    positive(
      "CLI intersects project and client",
      [RequestPageTransport.Cli, RequestPageSurface.Project],
      true,
    ),
    positive(
      "MCP intersects project and client",
      [RequestPageTransport.Mcp, RequestPageSurface.Project],
      true,
    ),
    positive(
      "HTTP unfiltered list spans harnesses",
      [RequestPageTransport.Http, RequestPageSurface.All],
      true,
    ),
    positive(
      "CLI unfiltered list spans harnesses",
      [RequestPageTransport.Cli, RequestPageSurface.All],
      true,
    ),
    positive(
      "MCP unfiltered list spans harnesses",
      [RequestPageTransport.Mcp, RequestPageSurface.All],
      true,
    ),
    positive(
      "HTTP selects an exact run",
      [RequestPageTransport.Http, RequestPageSurface.Run],
      true,
    ),
    positive("CLI selects an exact run", [RequestPageTransport.Cli, RequestPageSurface.Run], true),
    positive("MCP selects an exact run", [RequestPageTransport.Mcp, RequestPageSurface.Run], true),
    positive(
      "HTTP selects answered requests",
      [RequestPageTransport.Http, RequestPageSurface.Answered],
      true,
    ),
    positive(
      "CLI selects answered requests",
      [RequestPageTransport.Cli, RequestPageSurface.Answered],
      true,
    ),
    positive(
      "MCP selects answered requests",
      [RequestPageTransport.Mcp, RequestPageSurface.Answered],
      true,
    ),
  ],
  negative: [
    rejected(
      "HTTP refuses repeated selectors",
      [RequestPageTransport.Http, RequestPageSurface.Duplicate],
      true,
    ),
    rejected(
      "HTTP refuses write method on listing",
      [RequestPageTransport.Http, RequestPageSurface.Method],
      true,
    ),
    rejected(
      "HTTP refuses unknown selectors",
      [RequestPageTransport.Http, RequestPageSurface.Unknown],
      true,
    ),
    rejected(
      "CLI refuses unknown selectors before client",
      [RequestPageTransport.Cli, RequestPageSurface.Unknown],
      true,
    ),
    rejected(
      "MCP refuses unknown selectors",
      [RequestPageTransport.Mcp, RequestPageSurface.Unknown],
      true,
    ),
    rejected(
      "HTTP refuses zero count",
      [RequestPageTransport.Http, RequestPageSurface.InvalidLimit],
      true,
    ),
    rejected(
      "CLI refuses zero count before client",
      [RequestPageTransport.Cli, RequestPageSurface.InvalidLimit],
      true,
    ),
    rejected(
      "MCP refuses zero count",
      [RequestPageTransport.Mcp, RequestPageSurface.InvalidLimit],
      true,
    ),
  ],
};
