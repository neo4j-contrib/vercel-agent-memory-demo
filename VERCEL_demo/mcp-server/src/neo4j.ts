import neo4j, { type Driver } from "neo4j-driver";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in — see docs/mcp-connections.md.`,
    );
  }
  return value;
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

export async function closeDriver(): Promise<void> {
  await driver?.close();
  driver = undefined;
}


const INVESTMENTS_QUERY = `
MATCH (o:Organization)-[:HAS_INVESTOR]->(i)
WHERE o.name = $company
RETURN i.id as id, i.name as name, head(labels(i)) as type
`;


export async function getInvestments(company: string): Promise<string> {
  try {
    const { records } = await getDriver().executeQuery(
      INVESTMENTS_QUERY,
      { company },
      { database: requireEnv("NEO4J_DATABASE"), routing: "READ" },
    );
    if (records.length === 0) {
      return `No investments found for company: ${company}`;
    }
    return JSON.stringify(
      records.map((record) => toPlain(record.toObject())),
      null,
      2,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Error executing custom investment tool for company '${company}': ${message}`,
    );
    return `Error fetching investments: ${message}`;
  }
}

/** Neo4j Integers and temporal types are not JSON-serializable on their own. */
function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
}
