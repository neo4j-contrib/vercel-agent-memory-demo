# Agent Memory with Neo4j

A hands-on introduction to giving an AI agent memory, using the Neo4j Agent Memory Python SDK.

Everything runs against your own Neo4j instance. There are no API keys to sign up for and nothing leaves your machine.

## Files

| File | What it is |
|------|------------|
| `agent_memory_workshop.ipynb` | The main notebook. Work through it top to bottom. |
| `entity_extraction.py` | Entity extraction, run from a terminal partway through the notebook. |
| `.env` | Your Neo4j connection details. You create this. |

---

## The problem this solves

A language model has no memory. Every conversation starts from nothing.

The usual workaround is to paste recent messages back into the prompt. That helps a little, but it has limits:

- **It is flat.** Everything is text. You cannot ask "which companies has this user mentioned", because there are no companies, only tokens.
- **It does not persist.** New session, empty context.
- **It has no structure.** A vector store finds similar text, but it cannot tell you that John works at Nike and lives in San Francisco.

Agent memory stores conversations as a graph. People, places, companies and preferences become nodes with relationships between them, so you can query them, traverse them, and hand the relevant parts to a model as context.

---

## What you build

**Part 1 — Short-term memory.** Store and retrieve the messages in a conversation. This is the agent's working memory: what was said, in what order, in this session.

**Part 2 — Entity extraction.** Take a sentence like *"I've been using Nike Air Max shoes"* and pull out the things in it. Nike becomes an organization node, Air Max a product. This is where a chat log becomes a knowledge graph. Uses GLiNER, a small model that runs locally with no cost per message.

**Part 3 — Preferences.** Store what the user likes, so it survives after the conversation ends. Then retrieve it and format it as context for a model.

Each part is followed by Cypher queries so you can see exactly what was written to the database.

---

## Setup

### 1. Start Neo4j

You need the connection details for your aura instance.

### 2. Create a `.env` file

In the same folder as the notebook:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
NEO4J_DATABASE=neo4j
```

### 3. Install the packages

The notebook does this in its first cell. To do it yourself:

```bash
pip install "neo4j-agent-memory[gliner, openai]" python-dotenv jupyter
```

Python 3.10 or newer is required.

### 4. Run the notebook

```bash
jupyter notebook agent_memory_workshop.ipynb
```

Work through the cells in order. Partway through Part 2 the notebook asks you to run `entity_extraction.py` in a terminal, then continue in the notebook.

The first run of that script downloads the GLiNER model, a few hundred megabytes. If you are on shared wifi, run it early.

---

## Useful Cypher queries

Run these in Neo4j Browser at <http://localhost:7474>, or in the notebook with the `cypher()` helper.

**All messages**
```cypher
MATCH (m:Message)
RETURN m.role, m.content
ORDER BY m.created_at
```

**A conversation and its messages**
```cypher
MATCH (c:Conversation)-[r]->(m:Message)
RETURN c, r, m
```

**Extracted entities**
```cypher
MATCH (e:Entity)
RETURN e.name, e.type, labels(e)
```

**Entities grouped by type**
```cypher
MATCH (e:Entity)
RETURN e.type AS type, collect(e.name) AS entities, count(*) AS count
ORDER BY count DESC
```

**Messages and the entities mentioned in them**
```cypher
MATCH (m:Message)-[:MENTIONS]->(e:Entity)
RETURN m.content, e.name, e.type
```

**Stored preferences**
```cypher
MATCH (p:Preference)
RETURN p.category, p.preference
ORDER BY p.category
```

**Count everything by node type**
```cypher
MATCH (n)
RETURN labels(n) AS labels, count(*) AS count
ORDER BY count DESC
```

**The whole graph**
```cypher
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100
```

**Reset the database** — deletes everything, use only on a demo instance
```cypher
MATCH (n) DETACH DELETE n
```

---

## Notes

### Why everything is `await`ed

The SDK is asynchronous. In a script you wrap your code in `async def main()` and call `asyncio.run(main())`, which is what `entity_extraction.py` does. Jupyter already runs an event loop, so the notebook can use `await` directly in a cell.

### Why GLiNER rather than an LLM

An LLM can do entity extraction and the SDK supports it, but each call is slow and costs money. Extraction runs on every message, so the cost adds up quickly.

GLiNER runs locally, costs nothing, and handles most entities well. The usual pattern is to run a local extractor first and fall back to an LLM only for text it could not handle.

### POLE+O

The default entity types: **P**erson, **O**bject, **L**ocation, **E**vent and **O**rganization. It comes from intelligence analysis, and generalises well because most things people talk about are a person, a thing, a place, something that happened, or a group.

These become Neo4j labels, so a company node is `:Entity:Organization:Company`. You can query at any of those levels. If your domain needs different types, you can define your own.

### Self-hosted and hosted

This project uses the self-hosted path: your own Neo4j, full control, write access to Cypher, and it works offline.

There is also a hosted service, NAMS, where extraction, deduplication and embeddings run server-side and you only need an API key. It is the same client API, so switching is essentially one environment variable.

---

## Where to go next

### Tutorials

| Tutorial | Time | Covers |
|----------|------|--------|
| [NAMS Quickstart](https://neo4j.com/labs/agent-memory/) | ~10 min | The hosted path: API key, first memory operations |
| [Build Your First Memory-Enabled Agent](https://neo4j.com/labs/agent-memory/tutorials/first-agent-memory) | ~30 min | Self-hosted, ending with your context graph in Neo4j Browser |
| [Add Conversation Memory to a Chatbot](https://neo4j.com/labs/agent-memory/tutorials/conversation-memory) | ~45 min | A shopping assistant that learns brands, sizes and budget |
| [Build a Knowledge Graph from Documents](https://neo4j.com/labs/agent-memory/tutorials/knowledge-graph) | — | Extracting companies, people and securities from documents |

### Reference

- [Agent Memory home](https://neo4j.com/labs/agent-memory/)
- [Python SDK](https://neo4j.com/labs/agent-memory/sdks/python)
- [TypeScript SDK](https://neo4j.com/labs/agent-memory/sdks/typescript)
- [How-to guides](https://neo4j.com/labs/agent-memory/how-to)
- [Configure entity extraction](https://neo4j.com/labs/agent-memory/how-to/entity-extraction)

### Concepts

- [Memory types](https://neo4j.com/labs/agent-memory/explanation/memory-types/)
- [The POLE+O model](https://neo4j.com/labs/agent-memory/explanation/poleo-model/)
- [Backends](https://neo4j.com/labs/agent-memory/explanation/backends/)
- [NAMS dashboard docs](https://memory.neo4jlabs.com/docs)

### Packages

- Python: `pip install neo4j-agent-memory` — [PyPI](https://pypi.org/project/neo4j-agent-memory/)
- TypeScript: `npm install @neo4j-labs/agent-memory`

---