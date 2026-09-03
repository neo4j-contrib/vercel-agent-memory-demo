import { defineDynamic } from "eve";
import { defineMcpClientConnection } from "eve/connections";
import {
  MCP_TOOLS,
  MCP_URL,
  mcpReachable,
  neo4jMcpHeaders,
} from "../lib/neo4j";

export default defineDynamic({
  events: {
    "session.started": async () => {
      if (!MCP_URL) {
        console.warn(
          "[neo4j] MCP_URL is not set — graph tools are off this session",
        );
        return null;
      }

      if (!(await mcpReachable())) {
        console.warn(
          `[neo4j] no MCP server at ${MCP_URL} — graph tools are off this session`,
        );
        return null;
      }

      return defineMcpClientConnection({
        url: MCP_URL,
        description:
          "The Neo4j knowledge graph. Read the graph's schema (labels, relationship " +
          "types, property keys) and run read-only Cypher against it. Use for " +
          "anything structural — investors, subsidiaries, industries, counts, paths " +
          "— and check the schema with get-schema before writing a query.",
        headers: neo4jMcpHeaders,

        tools: {
          allow: [...MCP_TOOLS],
        },
      });
    },
  },
});
