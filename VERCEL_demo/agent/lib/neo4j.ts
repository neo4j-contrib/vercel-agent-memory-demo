import neo4j, { type Driver } from "neo4j-driver";

const env = (name: string): string => process.env[name]?.trim() ?? "";

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in — see docs/mcp-connections.md.`,
    );
  }
  return value;
}

export const MCP_URL = env("MCP_URL");

const MCP_USERNAME = env("MCP_NEO4J_USERNAME");
const MCP_PASSWORD = env("MCP_NEO4J_PASSWORD");
const MCP_BEARER_TOKEN = env("MCP_BEARER_TOKEN");

export const MCP_TOOLS = [
  "get-schema",
  "read-cypher",
  "list-gds-procedures",
] as const;


export type McpAuthMode = "none" | "basic" | "bearer";

export function mcpAuthMode(): McpAuthMode {
  const explicit = process.env.MCP_AUTH?.trim().toLowerCase();
  if (explicit === "none" || explicit === "basic" || explicit === "bearer") {
    return explicit;
  }

  // A token is only ever set on purpose, so it wins the guess.
  if (MCP_BEARER_TOKEN) return "bearer";
  if (MCP_USERNAME || MCP_PASSWORD) return "basic";
  return "none";
}

export function neo4jMcpHeaders(): Record<string, string> {
  switch (mcpAuthMode()) {
    case "none":
      return {};

    case "bearer": {
      if (!MCP_BEARER_TOKEN) {
        console.warn(
          "[neo4j] MCP_AUTH=bearer but MCP_BEARER_TOKEN is empty — the server will answer 401",
        );
        return {};
      }
      return { Authorization: `Bearer ${MCP_BEARER_TOKEN}` };
    }

    case "basic": {
      const encoded = Buffer.from(`${MCP_USERNAME}:${MCP_PASSWORD}`).toString(
        "base64",
      );
      return { Authorization: `Basic ${encoded}` };
    }
  }
}

const reachable = new Map<string, { at: number; ok: boolean }>();

/** HEADs an MCP endpoint to decide whether to mount its connection. Cached for a minute. */
export async function urlReachable(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 1500,
): Promise<boolean> {
  const cached = reachable.get(url);
  if (cached && Date.now() - cached.at < 60_000) return cached.ok;
  let ok = false;
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    ok = response.status < 500;
  } catch {
    ok = false;
  }
  reachable.set(url, { at: Date.now(), ok });
  return ok;
}

export async function mcpReachable(timeoutMs = 1500): Promise<boolean> {
  return urlReachable(MCP_URL, neo4jMcpHeaders(), timeoutMs);
}

let driver: Driver | undefined;

function getDriver(): Driver {
  driver ??= neo4j.driver(
    requireEnv("NEO4J_URI"),
    neo4j.auth.basic(requireEnv("NEO4J_USERNAME"), requireEnv("NEO4J_PASSWORD")),
    { maxConnectionPoolSize: 10, connectionAcquisitionTimeout: 10_000 },
  );
  return driver;
}

export async function readQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const { records } = await getDriver().executeQuery(cypher, params, {
    database: requireEnv("NEO4J_DATABASE"),
    routing: "READ",
  });
  return records.map((record) => toPlain(record.toObject()) as T);
}

function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("toString" in value && value.constructor?.name?.startsWith("Date")) {
      return String(value);
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
}
