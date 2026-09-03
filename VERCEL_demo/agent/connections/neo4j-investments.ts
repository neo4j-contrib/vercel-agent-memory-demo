import { defineDynamic } from "eve";
import { defineMcpClientConnection } from "eve/connections";
import { urlReachable } from "../lib/neo4j";

const INVESTMENTS_MCP_URL = process.env.INVESTMENTS_MCP_URL?.trim() ?? "";

export default defineDynamic({
  events: {
    "session.started": async () => {
      if (!INVESTMENTS_MCP_URL) {
        console.warn(
          "[neo4j] INVESTMENTS_MCP_URL is not set — the investments tool is off this session",
        );
        return null;
      }

      if (!(await urlReachable(INVESTMENTS_MCP_URL))) {
        console.warn(
          `[neo4j] no investments MCP server at ${INVESTMENTS_MCP_URL} — run \`npm run mcp\` to turn the tool on`,
        );
        return null;
      }

      return defineMcpClientConnection({
        url: INVESTMENTS_MCP_URL,
        description:
          "Investors in a company, from the Neo4j knowledge graph. Given an " +
          "exact company name, get_investments returns the ids, names, and " +
          "types of the investors recorded against it. Use it for " +
          "'who invested in X' questions instead of writing Cypher by hand.",

        tools: {
          allow: ["get_investments"],
        },
      });
    },
  },
});
