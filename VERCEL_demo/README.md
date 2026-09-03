# eve + Neo4j Agent Memory

A chatbot that **remembers you between conversations**.

Close the tab. Come back tomorrow. It still knows your name, your project, and
who your friends are — because none of that lived in the chat window. It lived
in a graph.

---

## What this workshop is about

Two ideas, and everything here exists to make them concrete.

**1. An agent is just files.** There is no framework ceremony. A file in
`agent/tools/` *is* a tool. Its filename *is* the tool's name. Add a file,
restart, the agent can do a new thing. That is [Vercel eve](https://eve.dev).

**2. Chat history is not memory.** Every chatbot "remembers" what you said two
messages ago — that is just the transcript being resent. Real memory survives a
closed tab, and it isn't a list, it's a graph of people, places and projects
that link to each other. That is
[Neo4j Agent Memory](https://neo4j.com/labs/agent-memory/) (NAMS).

The workshop is the comparison: the same agent, wired to the same memory, in
**four different ways** — plus `off`, so you can see what it's like without.

---

## How it actually works

```
  you type
     │
     ▼
  Next.js chat UI  ──────────►  eve agent  ──────────►  the model
  (app/, components/)           (agent/)                (OpenAI)
                                  │   │
        before answering: what do │   │ tools the model can call
        we know? after answering: │   │
        write it down             │   └──────────────┐
                                  ▼                  ▼
                        Neo4j Agent Memory      the company graph
                     (what it knows about you)     ├── over MCP
                                                   │   (mcp-server/, and any
                                                   │    Neo4j MCP server)
                                                   └── over Bolt
                                                       (search_news)
```

Two different graphs, and it is worth keeping them apart: **memory** is what the
agent knows about *you*, reached through NAMS; **the knowledge graph** is a
public dataset of companies and news, reached over MCP and Bolt. They share a
database engine and nothing else.

In plain language:

1. You type a message. The browser sends it to the **agent**, not to OpenAI.
2. The agent looks you up in Neo4j and quietly pastes what it finds into the
   prompt — *"this person is Ananya, she's building a drone project with
   Rohit."*
3. The model answers, having been told those things as if it already knew them.
4. The agent writes the new turn back to Neo4j, which pulls out the people and
   projects mentioned and links them into the graph.

Steps 2 and 4 are the whole trick, and switching `MEMORY_MODE` changes *who
does them* — the library invisibly (`provider`, `middleware`), the model itself
through tools (`tools`), or the eve runtime on every turn (`hooks`).

---

## Why Vercel

Four reasons this is built on Vercel's stack rather than a general framework.

**eve makes the agent a folder.** Tools, instructions, channels and connections
are files in `agent/`. There is no registry to update and nothing to import.
You can read the entire agent in five minutes, which matters a lot when you are
learning rather than shipping.

**One model, many providers.** The agent talks to the model through the
[AI SDK](https://ai-sdk.dev), so `openai/gpt-5.4-mini` can become
`anthropic/claude-sonnet-5` by editing one string. If you'd rather not manage a
provider key at all, Vercel AI Gateway takes one key and resolves every model
behind it.

**Sessions survive.** eve gives each conversation a durable id, so the chat can
be resumed after a refresh. That is what makes "close the tab and come back"
demonstrable rather than a claim.

**Deployment is one command.** `npm run deploy` puts the same agent on Vercel
with no config, so the last ten minutes of the workshop can be "now put it on
the internet".

---

## Setup

You need **Node 20 or newer** (`node -v`) and about five minutes.

```bash
npm install
cp .env.example .env
```

### Required

| Variable | What it's for | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | lets the agent think | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `MEMORY_API_KEY` | lets the agent remember — **only needed once `MEMORY_MODE` is not `off`** | [memory.neo4jlabs.com](https://memory.neo4jlabs.com) (free, starts with `nams_`) |
| `WORKSPACE_ID` | to remember the user workspace | [memory.neo4jlabs.com](https://memory.neo4jlabs.com) (workspace_id) |
| `MEMORY_ENDPOINT` | which NAMS server to call | already filled in by `.env.example` |
| `NEO4J_URI` + `NEO4J_USERNAME` + `NEO4J_PASSWORD` + `NEO4J_DATABASE` | the company graph `search_news` and `get_investments` read | already filled in by `.env.example` (the public demo graph) |

No endpoint or credential is hardcoded any more — `cp .env.example .env` is what
gives you working values. See [`docs/mcp-connections.md`](docs/mcp-connections.md).

### Optional

| Variable | Default | What it does |
|---|---|---|
| `MEMORY_MODE` | `off` | Which memory integration is live. See [the five modes](#the-five-modes). |
| `AI_GATEWAY_API_KEY` | — | Use Vercel AI Gateway instead of OpenAI directly. One key, every model. |
| `MODEL_ROUTING` | auto | Force `openai` or `gateway`. Left blank, OpenAI wins when its key is set and no gateway credential is present. |
| `AGENT_MODEL` | `openai/gpt-5.4-mini` | Which model answers. Try `anthropic/claude-sonnet-5` on the gateway route. |
| `AGENT_MODEL_CONTEXT_TOKENS` | `400000` | The model's context window. Lower it if you switch to a smaller model. |
| `MCP_URL` | — | The graph MCP server: local, the hosted demo, or Aura. Blank means the `get-schema` / `read-cypher` tools are off. |
| `MCP_AUTH` | auto | Force `none`, `basic` or `bearer`. Auto picks from the credentials you set. |
| `MCP_NEO4J_USERNAME` / `MCP_NEO4J_PASSWORD` | — | Basic auth for `MCP_URL`. The hosted demo takes `companies` / `companies`. |
| `MCP_BEARER_TOKEN` | — | Bearer token for an Aura MCP instance. |
| `NEO4J_MCP_BIN` | — | Path to the local `neo4j-mcp-server` executable. Normally discovered from `.venv` or `PATH`. |
| `NEO4J_MCP_READ_ONLY` | `true` | Keep the local graph MCP server read-only. Set `false` only when write access is intentional. |
| `NEO4J_TELEMETRY` | `false` | Enable or disable telemetry in the local graph MCP server. |
| `INVESTMENTS_MCP_URL` | `http://localhost:8100/mcp` in `.env.example` | The local MCP server in `mcp-server/`. Blank means `get_investments` is off. |

Every one of these is explained in [`docs/mcp-connections.md`](docs/mcp-connections.md)
— which server wants which, and how to tell which is live.

### Check it

```bash
npm run check
```

Tests your keys against the real services and tells you exactly what's wrong.
Fix anything red before moving on.

### Run it

```bash
npm run dev
```

It asks first: **memory on or off?** Say off and the agent forgets you between
chats. Say on and it asks **which mode** — `middleware`, `provider`, `tools`
(the model calls `query_memory` / `store_memory` itself) or `hooks` (the runtime
remembers on every turn). The pick applies to that run only; `.env` is left
alone, and pressing Enter twice keeps whatever `MEMORY_MODE` is already in
`.env`. In a non-interactive shell (CI) the prompt is skipped and `.env` wins.

Open <http://localhost:3000>.

For the `get_investments` tool, run the local MCP server alongside it in a
second terminal:

```bash
npm run mcp
```

To give the agent the generic Neo4j graph tools (`get-schema` and
`read-cypher`) without using a hosted MCP endpoint, install Neo4j's MCP server
once and run it in another terminal:

```bash
python -m venv .venv
.venv/bin/python -m pip install neo4j-mcp-server
npm run mcp:graph
```

Set `MCP_URL=http://localhost:8000/mcp` (or leave it blank; the launcher uses
that address by default) and set `MCP_NEO4J_USERNAME` and
`MCP_NEO4J_PASSWORD` to the Neo4j database credentials. In HTTP mode, the
server reads those credentials from each agent request rather than from its own
environment. `npm run mcp:graph` verifies that `MCP_URL` ends in `/mcp`, uses
the existing `NEO4J_URI` and `NEO4J_DATABASE`, and defaults to read-only access.

Both graph connections are optional — the agent starts fine without either and
just has fewer tools, logging which one it skipped and why.

---

## Try this first

Start with `MEMORY_MODE=off` — the default — and watch it fail.

1. *"I'm Ananya, I'm doing my final year project on drone navigation with my
   friend Rohit."*
2. Click **New chat**.
3. *"What am I working on?"*

It has no idea. Now set `MEMORY_MODE=provider` in `.env`, restart, and do
the same three steps.

It knows. Open the **Agent Memory** panel above the answer to see exactly what
it had to work with, then open <https://memory.neo4jlabs.com> and look at the
nodes it made.

---

## The five modes

Pick one at the `npm run dev` prompt (or set `MEMORY_MODE` in `.env` and just
press Enter through it), and the chip in the app's header changes with it.

| `MEMORY_MODE` | Who decides to remember | The code |  |
|---|---|---|---|
| `off` | nobody — it doesn't | — |
| `provider` | nobody — it always happens | [`agent/lib/model.ts`](agent/lib/model.ts) | |
| `middleware` | nobody — it always happens | [`agent/lib/model.ts`](agent/lib/model.ts) | |
| `tools` | the model, per turn | [`agent/tools/memory.ts`](agent/tools/memory.ts) | |
| `hooks` | the eve runtime, every turn | [`agent/hooks/`](agent/hooks/), [`agent/instructions/memory.ts`](agent/instructions/memory.ts) | |

Every non-`off` mode is the same
[`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider)
package, wired in at a different layer:

- **`provider` / `middleware`** wrap the model. One wraps the whole model
  *provider*, the other a single *model*; both are invisible to the model, which
  never sees a memory tool.
- **`tools`** hands the model `query_memory` and `store_memory` and lets it
  decide. Every call shows up in the **Reasoning Trace** — and so does every
  turn it forgets to call them.
- **`hooks`** attaches memory to eve's own turn events, where the model has no
  say. [`agent/instructions/memory.ts`](agent/instructions/memory.ts) recalls on
  `turn.started` and pastes what it finds into the prompt;
  [`agent/hooks/persist-turn.ts`](agent/hooks/persist-turn.ts) stores the
  exchange on `turn.completed`; and
  [`agent/hooks/persist-reasoning.ts`](agent/hooks/persist-reasoning.ts) records
  *why* — each reasoning step with the tool calls it made. All three go through
  one file, [`agent/lib/memory-gateway.ts`](agent/lib/memory-gateway.ts).

A hook that throws fails the whole turn, so every write is wrapped in
`try`/`catch`: if NAMS is down, the user still gets their answer.

---

## Where things live

```
agent/                       the agent itself
├── agent.ts                 which model answers
├── instructions.md          the system prompt, in plain English
├── lib/
│   ├── nams.ts              config: which mode, whose memory, which server
│   ├── memory-gateway.ts    the only file that calls the NAMS SDK
│   └── model.ts             builds the model, wrapping it with memory
├── instructions/
│   └── memory.ts            the `hooks` mode, recall — runs on turn.started
├── hooks/
│   ├── persist-turn.ts      the `hooks` mode, store — runs on turn.completed
│   └── persist-reasoning.ts the `hooks` mode, the why-trail
├── connections/
│   ├── neo4j-graph.ts       the Neo4j knowledge graph, over MCP (mounted only when reachable)
│   └── neo4j-investments.ts the local MCP server below (mounted only when reachable)
├── tools/
│   ├── memory.ts            the `tools` mode — query_memory / store_memory from the package
│   ├── calculator.ts        the hands-on exercise — docs/hands-on-tools.md
│   └── search_news.ts       an example tool that has nothing to do with memory
└── channels/
    └── eve.ts               who is allowed to talk to the agent

mcp-server/                  a local MCP server of our own — npm run mcp
├── README.md                its tools, transports and internals
├── src/server.ts            the MCP protocol: lists tools, routes calls
└── src/neo4j.ts             the Cypher behind get_investments

app/, components/            the chat UI, built on Neo4j's Needle design system
scripts/                     npm run check / demo / dev
docs/                        hands-on-tools.md    — add a tool, two ways
                             mcp-connections.md   — every MCP env var, and how to
                             point the agent at a local / hosted / Aura server
```

**Read `agent/lib/model.ts` first.** Every memory mode passes through it, and it
is about forty lines.

### The example tool

[`agent/tools/search_news.ts`](agent/tools/search_news.ts) exists to show what a
tool looks like when it isn't about memory. It runs a full-text query over the
public "Company News" graph — the article text the Neo4j MCP connection has no
tool for — through the Bolt route in
[`agent/lib/neo4j.ts`](agent/lib/neo4j.ts). Ask *"what's been written about
graph database funding?"* and watch it appear in the **Reasoning Trace** panel.
It needs no API key. The connection details are not written into the code —
set `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` / `NEO4J_DATABASE` in
`.env`, which `.env.example` pre-fills with the public `demo.neo4jlabs.com`
graph. See [`docs/mcp-connections.md`](docs/mcp-connections.md).

Copy it, rename the file, and you have a new tool — that is the whole extension
story.

**To try that yourself**, [`agent/tools/calculator.ts`](agent/tools/calculator.ts)
is a deliberately small one to take apart, and
[`app/api/playground/route.ts`](app/api/playground/route.ts) is the same tool
written by hand against the AI SDK, with no framework at all — so you can see
what eve is doing for you. The exercises are in
[`docs/hands-on-tools.md`](docs/hands-on-tools.md).

### The local MCP server

A tool does not have to live in `agent/tools/`. [`mcp-server/`](mcp-server/) is
a second way in: a small MCP server of our own, built following Neo4j's
[TypeScript MCP tutorial](https://neo4j.com/labs/agent-memory/tutorials/mcp-server-typescript/),
exposing one tool — `get_investments`, which returns the investors recorded
against a company.

```bash
npm run mcp     # http://localhost:8100/mcp
npm run dev     # in another terminal
```

Then ask *"who are the investors in Neo4j?"*.

The server speaks two transports from the same code:

| | how | who dials it |
| --- | --- | --- |
| Streamable HTTP | `npm run mcp` (default) | this agent, via `agent/connections/neo4j-investments.ts` |
| stdio | `MCP_TRANSPORT=stdio npm run mcp` | Claude Desktop and other stdio MCP clients |

HTTP is the default because an eve MCP connection dials a URL — it has no stdio
transport. The tutorial's stdio mode is kept for Claude Desktop, which does:

```json
{
  "mcpServers": {
    "neo4j-investments": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server/src/server.ts"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

Like `neo4j-graph.ts`, the connection is skipped when nothing answers at its
URL, so forgetting `npm run mcp` costs you the tool, not the session.

**Word the description the way people ask.** The model does not see connection
tools up front; it finds them through `connection_search`, which scores a tool
by token overlap with the question (tool name ×3, description ×1, substring
match either way). `get_investments` described only as returning *investments*
scored **zero** against "who are the investors in Neo4j" — `investments` and
`investors` are not substrings of one another — so the tool never reached the
model and the answer came back as "I couldn't retrieve the investor list". The
description now carries *investors*, *invested*, *backers*, and *funding*. If
you add a tool here, spend a minute on the nouns your users will actually type. Which
server the *other* connection dials — local, the hosted demo, or an Aura
instance — and every environment variable behind that choice is written up in
[`docs/mcp-connections.md`](docs/mcp-connections.md). The model
sees it namespaced by connection, as `neo4j-investments__get_investments` —
that is the name to assert on in an eval, as
[`evals/graph/investments.eval.ts`](evals/graph/investments.eval.ts) does.

---

## The chat UI

Two panels sit above every answer.

**Agent Memory** shows what the graph actually held, in five tabs: `recent`,
`observations`, `insights`, `entities` and `reasoning`. It reads Neo4j directly
through [`app/api/memory/route.ts`](app/api/memory/route.ts) rather than
watching for tool calls, which is what makes it work in *every* mode — in
`provider`, `middleware` and `hooks` the model never calls a memory tool, so
there would otherwise be nothing to show.

Its header also carries a badge naming **what drove memory on this turn**,
which is how you tell the modes apart at a glance:

| Mode | Badge |
|---|---|
| `provider` | `wrapped provider · never a tool call` |
| `middleware` | `wrapped model · never a tool call` |
| `tools` | `model called 2 memory tools` — or `called no memory tool`, on the turns it forgets |
| `hooks` | `runtime · 3 reasoning steps` |

The `reasoning` tab is the one only `hooks` fills: it is the decision trail
[`agent/hooks/persist-reasoning.ts`](agent/hooks/persist-reasoning.ts) writes —
one record per model step with the tools that step called. Every other mode
leaves it empty, which is the difference made visible.

**Reasoning Trace** shows the agent's own steps: its thinking, and every tool
call with its input and result. In `tools` mode `query_memory` and
`store_memory` show up in full — including the turns the model forgot to call
them. In `provider`, `middleware` and `hooks` memory never appears here at all,
because it happens around the model rather than as a tool. That contrast is the
workshop, made visible.

---

## Evals

`npm run eval` starts a throwaway agent and drives it like a user, then asserts
on what it produced. Four cases live in [`evals/`](evals/):

| Eval | What it pins down |
|---|---|
| [`memory/cross-session-recall`](evals/memory/cross-session-recall.eval.ts) | **the load-bearing one.** States a fact, calls `t.newSession()` to throw the transcript away, and asks again in a fresh session. Anything recalled after that came out of NAMS, not the conversation. Skips itself when `MEMORY_MODE=off`. |
| [`graph/news-search`](evals/graph/news-search.eval.ts) | a company question reaches `search_news` rather than being answered from model recall or a web search. |
| [`tools/calculator`](evals/tools/calculator.eval.ts) | the hands-on tool in `agent/tools/` is reached for arithmetic, and gets the sum right. Your check after doing [the exercise](docs/hands-on-tools.md). |
| [`graph/investments`](evals/graph/investments.eval.ts) | *"Who are the investors in Neo4j"* — asked plainly, with no hint of a tool name — reaches `neo4j-investments__get_investments` on the local MCP server. Needs `npm run mcp` running. |

```bash
npm run eval                       # everything
npm run eval -- --tag memory       # one tag
npm run eval -- --list             # show what would run
MEMORY_MODE=tools npm run eval     # pin the mode for the run
```

The recall eval passes in `provider`, `middleware`, `tools` and `hooks`. It is
worth running it in each: they all reach the same graph, and the eval is the
only thing that proves it.

Two notes if you write more:

- **Retrieval is lexical.** A shared workshop workspace fills with near-identical
  turns, so assert on a distinctive word (the eval uses a project *codename*),
  not a phrase like "final year project" that every earlier run also contains.
- **Ask the way a user would.** Naming the tool in the prompt makes an eval pass
  for the wrong reason: it was a hint like *"use the investments tool"* that hid
  a real tool-discovery bug until the prompt was changed to the plain question.
- **MCP tools are namespaced** `<connection>__<tool>`, so assert on
  `neo4j-investments__get_investments`, not `get_investments`.
- The judge model comes from [`evals/evals.config.ts`](evals/evals.config.ts);
  override it with `EVAL_JUDGE_MODEL`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run check` | verify your keys and setup |
| `npm run demo` | memory on its own, twenty lines, no agent |
| `npm run dev` | the chat app at localhost:3000 |
| `npm run mcp` | the local MCP server in `mcp-server/`, which serves `get_investments` |
| `npm run chat` | the same agent in your terminal, no browser |
| `npm run eval` | run the evals (see below) |
| `npm run typecheck` | catch mistakes before running |
| `npm run deploy` | put it on Vercel |

`npm run dev` runs two processes — the agent and the web UI — and wants about
**2 GB of free memory**. On a small machine, `npm run chat` gives you the same
agent and the same memory in your terminal for a fraction of that.

---

## Reference

- [eve docs](https://eve.dev/docs) · [AI SDK](https://ai-sdk.dev) · [Neo4j Agent Memory docs](https://neo4j.com/labs/agent-memory/)
- [`docs/hands-on-tools.md`](docs/hands-on-tools.md) — add a tool, the eve way and by hand
- [AI SDK v5 migration](https://ai-sdk.dev/docs/migration-guides) — this repo is on `ai@7`; older tutorials use `parameters` and `maxSteps`
- [`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider) — every non-`off` mode is built on this one package
- [`@neo4j-labs/agent-memory`](https://www.npmjs.com/package/@neo4j-labs/agent-memory) — the client underneath it

**MCP**

- [`docs/mcp-connections.md`](docs/mcp-connections.md) — every MCP environment variable, and how to point the agent at a local, hosted or Aura server
- [`mcp-server/README.md`](mcp-server/README.md) — the MCP server built in this repo
- [Model Context Protocol](https://modelcontextprotocol.io) · [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Neo4j's TypeScript MCP server tutorial](https://neo4j.com/labs/agent-memory/tutorials/mcp-server-typescript/) — what `mcp-server/` is built from
