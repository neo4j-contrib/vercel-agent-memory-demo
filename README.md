# Neo4j Agent Memory Workshop 

Giving an AI agent memory that survives a closed tab — built twice, in two
languages, at two levels of abstraction.

A language model has no memory. Every conversation starts from nothing, and the
usual workaround — pasting the last few messages back into the prompt — is flat
text that disappears with the session. Agent memory stores conversations as a
**graph** instead: people, places, companies and preferences become nodes with
relationships between them, so you can query them, traverse them, and hand the
relevant parts back to a model as context.

The workshop is in two parts, and they are meant to be done in order.

| | Part | Folder | Language | Where memory lives |
|---|---|---|---|---|
| **1** | [Memory by hand](#part-1--memory-by-hand-sdk_demo) | [SDK_demo/](SDK_demo/) | Python, in a notebook | your own Neo4j (self-hosted) |
| **2** | [Memory inside an agent](#part-2--memory-inside-an-agent-vercel_demo) | [VERCEL_demo/](VERCEL_demo/) | TypeScript, a real chat app | NAMS (hosted) |

---

## The through-line

**Part 1 takes the lid off.** You call the memory SDK directly — store a
message, extract the entities in it, save a preference — and then run Cypher to
see exactly what landed in the database. Nothing is hidden, because nothing is
automatic. By the end you know what "agent memory" physically *is*: nodes and
relationships you could have written yourself.

**Part 2 puts the lid back on.** Same idea, now inside a working chatbot: the
agent looks you up before answering and writes the turn back afterwards, and you
never see it happen. The interesting question stops being *what is stored* and
becomes **who decides to store it** — the library, the model, or the runtime.
Part 2 ships all four answers behind one environment variable so you can switch
between them mid-workshop.

Part 1 is why the magic in Part 2 isn't magic.

---

## Before you start

| You need | For | Check |
|---|---|---|
| **Python 3.10+** | Part 1 | `python --version` |
| **A Neo4j instance** (Aura or local) | Part 1 | you have a URI, user and password |
| **Node 20+** | Part 2 | `node -v` |
| **An OpenAI API key** | Part 2 | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **A free NAMS key** | Part 2, once memory is on | [memory.neo4jlabs.com](https://memory.neo4jlabs.com) — starts with `nams_` |

Two things worth doing **before** the room fills up, because both are slow on
shared wifi:

```bash
# Part 1 — downloads the GLiNER model, a few hundred MB
cd SDK_demo && pip install "neo4j-agent-memory[gliner, openai]" python-dotenv jupyter

# Part 2 — a large install
cd VERCEL_demo && npm install
```

The two parts have **separate `.env` files** in their own folders, and they do
not share values — Part 1 points at your own Neo4j, Part 2 at NAMS plus a public
demo graph. Note the spelling differs: Part 1 reads `NEO4J_USER`, Part 2 reads
`NEO4J_USERNAME`.

---

## Part 1 — Memory by hand ([SDK_demo/](SDK_demo/))

A notebook, worked top to bottom, against your own Neo4j. No API keys to sign up
for and nothing leaves your machine.

### What you build

1. **Short-term memory** — store and retrieve the messages in a conversation.
   The agent's working memory: what was said, in what order, in this session.
2. **Entity extraction** — turn *"I've been using Nike Air Max shoes"* into a
   `:Organization` node and a `:Product` node. This is where a chat log becomes
   a knowledge graph. Runs on GLiNER, a small local model with no per-message
   cost.
3. **Preferences** — store what the user likes so it outlives the conversation,
   then format it as context for a model.

Each part is followed by Cypher so you can see what was actually written.

### Setup

Create `SDK_demo/.env` with your instance details:

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
NEO4J_DATABASE=neo4j
```

Then install (the notebook's first cell does this too):

```bash
pip install "neo4j-agent-memory[gliner, openai]" python-dotenv jupyter
```

### Run it

```bash
cd SDK_demo
jupyter notebook agent_memory_workshop.ipynb
```

Work through the cells in order. Partway through Part 2 of the notebook it asks
you to drop into a terminal:

```bash
python entity_extraction.py
```

— then come back to the notebook and look at what appeared in the graph.

### Look at what you made

In Neo4j Browser (<http://localhost:7474> for a local instance), or with the
notebook's `cypher()` helper:

```cypher
MATCH (m:Message)-[:MENTIONS]->(e:Entity)
RETURN m.content, e.name, e.type
```

[`SDK_demo/README.md`](SDK_demo/README.md) has the full query set — every node
type, the whole graph, and the reset query — plus notes on why everything is
`await`ed, why GLiNER instead of an LLM, and what **POLE+O** (Person, Object,
Location, Event, Organization) means.

---

## Part 2 — Memory inside an agent ([VERCEL_demo/](VERCEL_demo/))

A chatbot that remembers you between conversations. Close the tab, come back
tomorrow, and it still knows your name and your project — because none of that
lived in the chat window.

Built on [Vercel eve](https://eve.dev), where **an agent is just files**: a file
in `agent/tools/` *is* a tool and its filename *is* the tool's name. Add a file,
restart, the agent can do a new thing.

### Setup

```bash
cd VERCEL_demo
npm install
cp .env.example .env
```

Fill in the required block of `.env`:

| Variable | What it's for |
|---|---|
| `OPENAI_API_KEY` | lets the agent think |
| `MEMORY_MODE` | which memory integration is live — start at `off` |
| `MEMORY_API_KEY` | lets the agent remember — only once `MEMORY_MODE` is not `off` |
| `WORKSPACE_ID` | **your own name**, so you don't share a brain with the person next to you |

Everything else has a working default already filled in by `.env.example`,
including the public read-only demo graph the `search_news` and `get_investments`
tools read.

```bash
npm run check     # tests your keys against the real services
npm run dev       # then open http://localhost:3000
```

`npm run dev` asks **memory on or off?**, and if on, **which mode**. The choice
applies to that run only — `.env` is left alone.

### Try this first — watch it fail

Start with `MEMORY_MODE=off`.

1. *"I'm Ananya, I'm doing my final year project on drone navigation with my
   friend Rohit."*
2. Click **New chat**.
3. *"What am I working on?"*

It has no idea. Now set `MEMORY_MODE=provider`, restart, repeat. It knows — and
the **Agent Memory** panel above the answer shows you exactly what it had to
work with. Open <https://memory.neo4jlabs.com> to see the nodes it made.

### The five modes

The workshop is the comparison: the same agent, the same memory, wired in four
different ways, plus `off`.

| `MEMORY_MODE` | Who decides to remember |
|---|---|
| `off` | nobody — it doesn't |
| `provider` | nobody — it always happens, wrapping the model *provider* |
| `middleware` | nobody — it always happens, wrapping one *model* |
| `tools` | the model, per turn — and you can watch it forget |
| `hooks` | the eve runtime, on every turn — the model has no say |

Every non-`off` mode is the same
[`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider)
package at a different layer. The difference is visible in the UI: in `tools`
mode the memory calls appear in the **Reasoning Trace**; in the others memory
never shows up there at all, because it happens *around* the model rather than
as a tool.

**Read [`VERCEL_demo/agent/lib/model.ts`](VERCEL_demo/agent/lib/model.ts)
first** — every mode passes through it, and it is about forty lines.

### Then go further

| | Where |
|---|---|
| Add a tool | copy [`agent/tools/search_news.ts`](VERCEL_demo/agent/tools/search_news.ts), rename the file — that's the whole extension story. [`agent/tools/calculator.ts`](VERCEL_demo/agent/tools/calculator.ts) is a small one to take apart |
| Add a tool the *other* way | [`mcp-server/`](VERCEL_demo/mcp-server/) — a local MCP server exposing `get_investments`. `npm run mcp`, then ask *"who are the investors in Neo4j?"* |
| Prove it works | `npm run eval` — four cases in [`evals/`](VERCEL_demo/evals/), including a cross-session recall test that throws the transcript away and asks again |
| Ship it | `npm run deploy` |

Full detail, including all the optional environment variables and the eval
notes, is in [`VERCEL_demo/README.md`](VERCEL_demo/README.md).

---

## The two parts, side by side

| | Part 1 (Python SDK) | Part 2 (eve agent) |
|---|---|---|
| Backend | self-hosted Neo4j — your own instance, full Cypher access, works offline | NAMS, hosted — extraction, deduplication and embeddings run server-side |
| Credentials | Neo4j URI + password | one `nams_` API key |
| Extraction | you call GLiNER yourself | happens server-side, invisibly |
| Memory calls | explicit, one line at a time | wrapped in a provider, a tool, or a hook |
| You see | every node as it is written | a chatbot that just knows things |
| Client API | the same | the same |

The last row is the point: switching between the two backends is essentially one
environment variable, not a rewrite.

---

## Commands

**Part 1**

| Command | What it does |
|---|---|
| `jupyter notebook agent_memory_workshop.ipynb` | the workshop |
| `python entity_extraction.py` | the terminal step, partway through |

**Part 2** (all from `VERCEL_demo/`)

| Command | What it does |
|---|---|
| `npm run check` | verify your keys and setup |
| `npm run demo` | memory on its own, twenty lines, no agent |
| `npm run dev` | the chat app at localhost:3000 |
| `npm run chat` | the same agent in your terminal, no browser — much lighter |
| `npm run mcp` | the local MCP server that serves `get_investments` |
| `npm run eval` | run the evals |
| `npm run typecheck` | catch mistakes before running |
| `npm run deploy` | put it on Vercel |

`npm run dev` runs two processes and wants about **2 GB of free memory**. On a
small machine use `npm run chat` instead — same agent, same memory, in the
terminal.

---

## If something breaks

| Symptom | Usually |
|---|---|
| Part 1 hangs on the first extraction | GLiNER is downloading the model. First run only. |
| Part 1 can't connect | `.env` is not next to the notebook, or `NEO4J_URI` needs `neo4j+s://` for Aura |
| Part 2: `npm run check` is red | fix it before running anything else — it tests against the real services |
| Part 2 forgets you | `MEMORY_MODE` is still `off`, or `MEMORY_API_KEY` / `WORKSPACE_ID` are blank |
| Part 2: you see someone else's memories | you're sharing a `WORKSPACE_ID`. Put your own name in it. |
| Part 2: `get_investments` is missing | `npm run mcp` isn't running. The connection is skipped when nothing answers, so this costs the tool, not the session. |
| Part 2: graph tools missing | `MCP_URL` is blank or unreachable — same story, the agent starts fine without it |

---

## Reference

**Agent Memory**

- [Agent Memory home](https://neo4j.com/labs/agent-memory/) · [Python SDK](https://neo4j.com/labs/agent-memory/sdks/python) · [TypeScript SDK](https://neo4j.com/labs/agent-memory/sdks/typescript)
- [Memory types](https://neo4j.com/labs/agent-memory/explanation/memory-types/) · [The POLE+O model](https://neo4j.com/labs/agent-memory/explanation/poleo-model/) · [Backends](https://neo4j.com/labs/agent-memory/explanation/backends/)
- [NAMS dashboard docs](https://memory.neo4jlabs.com/docs)
- Packages: `pip install neo4j-agent-memory` · `npm install @neo4j-labs/agent-memory`

**Tutorials to continue with**

| Tutorial | Time |
|---|---|
| [NAMS Quickstart](https://neo4j.com/labs/agent-memory/) | ~10 min |
| [Build Your First Memory-Enabled Agent](https://neo4j.com/labs/agent-memory/tutorials/first-agent-memory) | ~30 min |
| [Add Conversation Memory to a Chatbot](https://neo4j.com/labs/agent-memory/tutorials/conversation-memory) | ~45 min |
| [Build a Knowledge Graph from Documents](https://neo4j.com/labs/agent-memory/tutorials/knowledge-graph) | — |

**The Part 2 stack**

- [eve docs](https://eve.dev/docs) · [AI SDK](https://ai-sdk.dev) · [AI SDK v5 migration](https://ai-sdk.dev/docs/migration-guides) (this repo is on `ai@7`; older tutorials use `parameters` and `maxSteps`)
- [Model Context Protocol](https://modelcontextprotocol.io) · [Neo4j's TypeScript MCP server tutorial](https://neo4j.com/labs/agent-memory/tutorials/mcp-server-typescript/) — what `mcp-server/` is built from
 