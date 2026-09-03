import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { closeDriver, getInvestments } from "./neo4j.js";


try {
  process.loadEnvFile?.();
} catch {
  console.log('no env set')
}

const NAME = "neo4j-investments-mcp";
const VERSION = "0.1.0";

const PORT = Number(process.env.INVESTMENTS_MCP_PORT?.trim() || 8100);
const PATH = process.env.INVESTMENTS_MCP_PATH?.trim() || "/mcp";
const TRANSPORT =
  process.env.MCP_TRANSPORT?.trim().toLowerCase() === "stdio" ? "stdio" : "http";

const TOOLS: Tool[] = [
  {
    name: "get_investments",
    description:
      "Look up the investors in a company by its exact name. " +
      "Returns the id, name, and type of each investor — Person or Organization. " +
      "Use this for questions about who invested in a company, " +
      "who its investors or backers are, and its funding relationships.",
    inputSchema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Exact company name as it appears in the graph, e.g. 'Neo4j'.",
        },
      },
      required: ["company"],
    },
  },
];


function buildServer(): Server {
  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== "get_investments") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }

    const company = (req.params.arguments ?? {}).company;
    if (typeof company !== "string" || company.trim() === "") {
      return {
        content: [{ type: "text", text: "get_investments needs a company name." }],
        isError: true,
      };
    }

    return { content: [{ type: "text", text: await getInvestments(company) }] };
  });

  return server;
}

async function main() {
  if (TRANSPORT === "stdio") {
    const server = buildServer();
    await server.connect(new StdioServerTransport());
    console.error(`${NAME} listening on stdio`);
    return;
  }

  const http = createServer((req, res) => {
    void handleHttp(req, res).catch((error) => {
      console.error("[mcp] request failed:", error);
      if (!res.headersSent) res.writeHead(500).end();
    });
  });

  http.listen(PORT, () => {
    console.error(`${NAME} listening at http://localhost:${PORT}${PATH}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      http.close();
      void closeDriver().finally(() => process.exit(0));
    });
  }
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "HEAD") {
    res.writeHead(url.pathname === PATH ? 200 : 404).end();
    return;
  }

  if (url.pathname !== PATH) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Not found. MCP is served at ${PATH}.` }));
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer();

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
