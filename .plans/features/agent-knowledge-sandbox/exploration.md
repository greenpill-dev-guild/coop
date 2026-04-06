# Agent Knowledge Sandbox: Curated Sources + Graph Memory

**Status**: Exploration
**Created**: 2026-04-05
**Origin**: Afolabi's vision for sandboxed agent knowledge access — "YouTube Kids for AI agents"
**Video reference**: https://youtu.be/qMV64p-4Deo — Will (Neo4j AI Innovation PM) at Context Graph Meetup

---

## 1. The Core Idea

Just as YouTube Kids restricts what content a child can discover and consume, a **sandboxed
agent knowledge environment** restricts what information an AI agent can access, ingest, and
reason over. The agent never touches the open web. Instead, it operates within a curated
knowledge universe defined by its coop members.

This is a fundamentally different trust model from most AI agent frameworks (OpenClaw, Devin,
etc.) which give agents broad internet access and try to sandbox execution. Coop inverts this:
**sandbox the knowledge, not just the execution**.

With a minimal set of source types — YouTube channels, GitHub repos, RSS feeds, Reddit
subreddits, and NPM packages — you create a rich but bounded information environment. Users
allowlist specific channels, feeds, and repos. The agent can only learn from what the coop
explicitly trusts.

As the agent binary matures and gets embedded deeper into Coop, this sandbox becomes the
foundation for trusted autonomous agents that grow their knowledge safely — the same way a
child learns through curated educational content before accessing the broader internet.

---

## 2. Source Registry: What the Agent Can See

### 2.1 Knowledge Sources

| Source Type | Access Method | Allowlist Unit | Content Extracted | Refresh |
|-------------|--------------|----------------|-------------------|---------|
| **YouTube** | `youtube-caption-extractor` or TranscriptAPI | Channel ID | Transcripts, titles, descriptions | On-demand / weekly |
| **GitHub** | Contents API or GitExtract JSON API | `owner/repo` | README, source, issues, package.json | On webhook or daily |
| **RSS/Atom** | `rss-parser` npm or `feed-mcp` MCP server | Feed URL | Articles, author, metadata | Poll interval |
| **Reddit** | JSON API (`/r/{sub}/hot.json`) | Subreddit | Posts, top comments, engagement | Hourly poll |
| **NPM** | Registry API (`registry.npmjs.org/{pkg}`) | Package name/scope | Metadata, README, versions, deps | On version publish |
| **Wikipedia** | MediaWiki API (`en.wikipedia.org/w/api.php`) | Article title or Wikidata QID | Article content, infobox, categories, linked entities | On-demand (enrichment) |
| **Git** (local) | Existing `pageExtracts` pipeline | Repository path | Code structure, diffs, history | On capture |

### 2.2 Communication Sources

| Source Type | Protocol | Role in Coop | Notes |
|-------------|----------|--------------|-------|
| **Signal** | Coop OS (core coordination) | Member-to-member + agent notifications | Primary trusted channel |
| **Discord** | Coop X (community interface) | Broader community engagement + agent presence | Bot API, channel-scoped |

### 2.3 Enforcement Architecture

```
Layer 1: Hard Denylist (non-overridable)
  - Block private IPs, localhost, credential files
  - Coop already does this in assertSafeSkillUrl()

Layer 2: Source Registry (configurable per coop)
  - YouTube channels, GitHub repos, RSS feeds, subreddits, NPM packages
  - Stored in Dexie `knowledgeSources` table, synced via Yjs
  - Each source: { type, identifier, label, addedBy, addedAt, active }

Layer 3: Default-Deny
  - Everything not in the registry requires explicit member approval
  - Agent can suggest new sources, members approve via review flow
```

This extends the existing `assertSafeSkillUrl()` into a general `assertAllowedSource(url, sourceType)` that checks against the registry before any external fetch.

---

## 3. Graph Memory: How the Agent Remembers

### 3.1 Why Graph > Flat Markdown

Coop's current agent memory is stored as flat records in Dexie's `agentMemories` table. This
works for simple recall but has fundamental limitations:

| Capability | Flat Memory (Current) | Graph Memory (Proposed) |
|------------|----------------------|------------------------|
| Entity relationships | None — memories are isolated records | First-class edges between entities |
| Temporal reasoning | CreatedAt timestamp only | Validity windows on edges (Graphiti pattern) |
| Semantic search | None — exact match or recency | Vector similarity + BM25 hybrid |
| Contradiction handling | Manual — newer overwrites older | Temporal invalidation, history preserved |
| Cross-session context | Recency-biased flat list | Graph traversal discovers deep connections |
| Query performance | O(n) scan | Sub-millisecond graph traversal |

### 3.2 The Zep/Graphiti Pattern

The [Zep paper](https://arxiv.org/abs/2501.13956) establishes the state-of-the-art for agent
memory using temporal knowledge graphs:

- **Bi-temporal model**: Every edge tracks when an event *occurred* AND when it was *ingested*
- **Validity windows**: Facts have `(t_valid, t_invalid)` — when info changes, old facts are
  invalidated but not deleted, enabling "what was true when?" queries
- **Hybrid retrieval**: Cosine similarity + BM25 full-text + breadth-first graph traversal
- **No LLM during retrieval**: Critical for in-browser performance — inference only during ingestion
- **Benchmark results**: 94.8% accuracy on Deep Memory Retrieval (vs 93.4% MemGPT), 18.5%
  improvement on LongMemEval with 90% latency reduction

### 3.3 Browser-Viable Graph Databases

| Database | Browser Support | Storage | Fit for Coop |
|----------|----------------|---------|-------------|
| **Kuzu-WASM** | Full WASM build (~4MB) | IndexedDB (IDBFS) | **Best fit** — Cypher queries, vector indexes, full-text search, demonstrated Graph RAG with WebLLM |
| **LevelGraph** | IndexedDB via level.js | IndexedDB | Lighter alternative — triple store, hexastore indexing, Gremlin-inspired API |
| **Quadstore** | LevelDB backends | IndexedDB | SPARQL support — heavier, more standards-compliant |

**Note**: KuzuDB was archived Oct 2025. Active fork at [Vela-Engineering/kuzu](https://github.com/Vela-Engineering/kuzu) with concurrent write support for multi-agent workloads. Benchmarks show 374x faster path queries than Neo4j.

### 3.4 Graph Entity Model (POLE+O)

Adapted from the Zep/Graphiti POLE model for Coop's domain:

```
PERSON (Member, Operator, External Contact)
  ├── ORGANIZATION (Coop, DAO, Protocol, Company)
  ├── LOCATION (Chain, Network, Region)
  ├── EVENT (Capture, Publish, Archive, Transaction)
  └── OBSERVATION (Agent insight, Draft, Skill output)

Edges carry:
  - relationship type (member_of, published_to, derived_from, etc.)
  - confidence score
  - validity window (t_valid, t_invalid)
  - provenance (which skill/source created this edge)
```

### 3.5 Three Memory Tiers

| Tier | What | Storage | Retention |
|------|------|---------|-----------|
| **Episodic** | Conversation history, session context, observation logs | Short-lived nodes, auto-pruned | 30 days |
| **Semantic** | Entities, relationships, domain knowledge from sources | Persistent graph with temporal edges | Indefinite |
| **Procedural** | Decision traces, skill output provenance, learned behaviors | Edge metadata + pattern nodes | Evolving |

---

## 4. OpenClaw Lessons

[OpenClaw](https://github.com/openclaw/openclaw) (247K GitHub stars, created by Peter
Steinberger) is the fastest-growing open-source agent — and its architecture both validates
and warns.

### What OpenClaw Got Right (Adopt)

| Pattern | OpenClaw | Coop Analog |
|---------|----------|-------------|
| **Skill injection** | SKILL.md files, progressive disclosure (name+desc first, full on activation) | Already doing this in `agent-knowledge.ts`. Adopt the 250ms hot-reload debounce. |
| **Lane queue** | Serial task queue per session, prevents race conditions | Apply to observe-plan-act cycle |
| **Memory hybrid search** | SQLite vector + BM25 + structured files | Replace with Kuzu-WASM graph + vector + BM25 |
| **Session trust boundaries** | Session IDs encode trust level (main/dm/group) | Maps to policy/session/permit capability model |
| **Prompt layering** | 7-layer composition (core → personality → skills → memory → tools) | Existing skill prompt assembly does a version; formalize it |

### What OpenClaw Got Wrong (Avoid)

| Issue | What Happened | Coop Mitigation |
|-------|--------------|-----------------|
| **CVE-2026-25253** | Missing WebSocket origin validation → zero-click RCE | Authenticate every network boundary, including local signaling |
| **ClawHub supply chain** | Malicious skills injected harmful instructions via SKILL.md | Content scanning for injected prompts, source allowlisting |
| **Plaintext credentials** | API keys stored in readable files | Use browser credential storage, never persist secrets in IndexedDB |
| **Broad internet access** | Agent can fetch anything → data exfiltration vector | **This is exactly what the knowledge sandbox prevents** |

### The Key Insight

OpenClaw proved that agents can be powerful with skills + memory + tools. But it also proved
that **unrestricted access is a security liability**. The knowledge sandbox is the answer:
same power, bounded by trust.

---

## 5. How This Maps to Coop's Architecture

### 5.1 What Already Exists

```
CAPTURE (tabs, receiver, agent observations)
  → SKILL.md knowledge import with URL safety validation
  → 16-skill DAG with topological sort
  → 3-tier inference cascade (WebLLM → Transformers.js → heuristic)
  → agentMemories Dexie table (flat records)
  → assertSafeSkillUrl() SSRF protection
  → Session keys for bounded onchain execution
  → ERC-8004 agent identity registry
```

### 5.2 What This Adds

```
SOURCE REGISTRY (new Dexie table, synced via Yjs)
  → Source-type adapters (YouTube, GitHub, RSS, Reddit, NPM)
  → assertAllowedSource() enforcement at fetch layer
  → Member-managed allowlists per coop

GRAPH MEMORY (Kuzu-WASM in offscreen document)
  → Replace flat agentMemories with temporal knowledge graph
  → POLE+O entity model with validity windows
  → Hybrid retrieval: vector + BM25 + graph traversal
  → No LLM during retrieval (Zep pattern)
  → Coexists with Dexie (both use IndexedDB)

AGENT BINARY EVOLUTION (longer-term)
  → Self-contained runtime in offscreen document
  → Knowledge sandbox as default security posture
  → Graph memory as the agent's "brain"
  → Source registry as the agent's "allowed world"
```

### 5.3 Proposed Architecture Diagram

```
+---------------------------------------------------------------+
|                    COOP AGENT KNOWLEDGE OS                     |
+---------------------------------------------------------------+
|                                                                |
|  LAYER 1: SOURCE REGISTRY (what the agent can see)             |
|  +---------------------------------------------------------+  |
|  | YouTube Channels  | GitHub Repos    | RSS Feeds          |  |
|  | [UCxxx, UCyyy]    | [org/repo-a]    | [feed-url-1]       |  |
|  |                   |                 |                     |  |
|  | Subreddits        | NPM Packages    | SKILL.md URLs      |  |
|  | [r/ethdev]        | [@coop/shared]  | [skill-url-1]      |  |
|  +---------------------------------------------------------+  |
|  Synced via Yjs across coop members                            |
|  Enforced at fetch layer (extends assertSafeSkillUrl)          |
|                                                                |
|  LAYER 2: KNOWLEDGE GRAPH (how the agent remembers)            |
|  +---------------------------------------------------------+  |
|  | Kuzu-WASM (IndexedDB persistence via IDBFS)              |  |
|  |                                                           |  |
|  | Episodic: session context, observation logs               |  |
|  | Semantic: entities + relationships (POLE+O model)         |  |
|  | Temporal: validity windows on edges (Graphiti pattern)    |  |
|  | Procedural: decision traces, skill provenance             |  |
|  |                                                           |  |
|  | Retrieval: vector similarity + BM25 + graph traversal     |  |
|  | No LLM calls during retrieval                             |  |
|  +---------------------------------------------------------+  |
|  Runs in offscreen document alongside WebLLM                   |
|                                                                |
|  LAYER 3: EXECUTION SANDBOX (how the agent acts)               |
|  +---------------------------------------------------------+  |
|  | Offscreen document = agent runtime                        |  |
|  | WebLLM (Tier 1) + Transformers.js (Tier 2) + Heuristic   |  |
|  |                                                           |  |
|  | Skill injection: selective per-turn (OpenClaw pattern)    |  |
|  | Source fetch: allowlisted URLs only                        |  |
|  | Network: blocked except registered sources                 |  |
|  | Storage: Dexie + Kuzu-WASM (local only)                   |  |
|  | Trust: session-scoped permissions                          |  |
|  +---------------------------------------------------------+  |
|  All execution local-first, zero cloud dependency              |
|                                                                |
|  LAYER 4: COMMUNICATION (how the agent coordinates)            |
|  +---------------------------------------------------------+  |
|  | Signal (Coop OS) — core member coordination               |  |
|  | Discord (Coop X) — community interface + agent presence   |  |
|  | Yjs (peer sync) — CRDT state propagation                  |  |
|  | Signaling (relay) — cross-coop agent messages              |  |
|  +---------------------------------------------------------+  |
|                                                                |
+---------------------------------------------------------------+
```

---

## 6. Knowledge Ingestion Pipeline

### How Each Source Feeds the Graph

```
YouTube Channel (allowlisted)
  → youtube-caption-extractor → transcript text
  → Entity extraction skill → Person, Topic, Concept nodes
  → Temporal edges: "discussed_in" with video date as validity start

GitHub Repo (allowlisted)
  → Contents API / GitExtract → README, source, issues
  → Code analysis skill → Function, Pattern, Dependency nodes
  → Temporal edges: "defined_in" with commit date as validity

RSS Feed (allowlisted)
  → rss-parser → article body, author, tags
  → Theme clustering skill → Topic, Trend, Position nodes
  → Temporal edges: "published_at" with article date

Reddit Subreddit (allowlisted)
  → JSON API → posts, top comments, engagement
  → Sentiment + entity extraction → Discussion, Opinion nodes
  → Temporal edges: "discussed_at" with post date

NPM Package (allowlisted)
  → Registry API → metadata, README, deps
  → Dependency analysis → Package, Version, API nodes
  → Temporal edges: "released_at" with publish date
```

### Graph Retrieval at Inference Time

When the agent needs context for a skill run:

1. **Observation** triggers skill selection (existing flow)
2. **Skill prompt** includes a retrieval query
3. **Hybrid search** runs against Kuzu-WASM:
   - Vector similarity on query embedding vs node embeddings
   - BM25 full-text on query terms vs node content
   - 1-hop graph traversal from top-K results
4. **Context assembly**: Top results + their graph neighbors → injected into skill prompt
5. **No LLM call during retrieval** — only during the skill inference itself

---

## 7. Graph Memory vs Markdown Memory

### Why This Matters for Coop Specifically

Coop's agent doesn't just need to remember facts — it needs to understand **relationships
between knowledge across sources, members, and time**. Examples:

| Query | Flat Memory Answer | Graph Memory Answer |
|-------|--------------------|---------------------|
| "What does this coop care about?" | Most recent memory entries | Graph traversal: topics with most edges from this coop's artifacts, weighted by recency |
| "Is this grant relevant to us?" | Text match against stored keywords | Semantic similarity to our topic cluster + graph path to our domain entities |
| "What changed since last week?" | Memories with recent timestamps | Temporal query: edges with `t_valid > lastWeek`, grouped by entity |
| "Who in the coop knows about Filecoin?" | No relational data | Graph: members → published_about → topics containing "Filecoin" |
| "Has this source been reliable?" | No provenance tracking | Graph: source node → derived_from edges → artifact outcomes |

### Migration Path

The transition from flat to graph doesn't need to be big-bang:

1. **Phase 1**: Add Kuzu-WASM alongside existing Dexie memories. New knowledge from
   source adapters goes into the graph. Existing memories continue in Dexie.
2. **Phase 2**: Add graph retrieval as an additional context source for skill prompts.
   Flat memories still used as fallback.
3. **Phase 3**: Migrate existing memories into graph nodes. Dexie `agentMemories` table
   becomes a write-through cache for the graph.
4. **Phase 4**: Graph is primary. Flat table deprecated.

---

## 8. The "Agent Binary" Vision

As the knowledge sandbox and graph memory mature, they form the core of what becomes the
**agent binary** — a self-contained, portable agent runtime:

```
Agent Binary = Knowledge Sandbox + Graph Memory + Inference Engine + Skill Registry

Properties:
  - Runs entirely in-browser (offscreen document / Web Worker)
  - No cloud dependency for core operation
  - Portable: same binary works in extension, PWA, or standalone
  - Sandboxed by default: only accesses allowlisted sources
  - Grows safely: knowledge expands within trusted boundaries
  - Verifiable: ERC-8004 identity, Safe multisig for actions
```

This mirrors how children develop: they learn from curated, trusted sources (parents, school,
YouTube Kids) before being given unrestricted internet access. The agent starts with a narrow,
trusted knowledge universe and earns broader access as the coop builds confidence.

### Maturity Levels

| Level | Access | Autonomy | Trust Signal |
|-------|--------|----------|-------------|
| **Seedling** | 3-5 allowlisted sources, no spending | Observe + suggest only | New coop, unproven agent |
| **Sapling** | 10-20 sources, micro-spending (<$1/day) | Auto-execute below threshold | Consistent good suggestions, member approval |
| **Mature** | Full source registry, spending limits | Propose + auto-execute within policy | Track record, operator endorsement |
| **Trusted** | Cross-coop sources, inter-agent comms | Autonomous within session scope | Multi-coop reputation, ERC-8004 history |

---

## 9. Concrete NPM Packages

| Package | Purpose | Size | Browser | Status |
|---------|---------|------|---------|--------|
| `@kuzu/kuzu-wasm` | Embedded graph DB | ~4MB WASM | Yes (IDBFS) | Active fork at Vela-Engineering/kuzu |
| `youtube-caption-extractor` | YouTube transcript extraction | Light | Yes | Most reliable JS option in 2026 |
| `rss-parser` | RSS/Atom feed parsing | Light | Yes | Mature, widely used |
| `query-registry` | NPM metadata access | Light | Yes | Wraps registry API |
| `feed-mcp` | RSS→MCP bridge | Go binary | Server-side | MCP protocol native |
| `levelgraph` | Lighter graph alternative | ~50KB | Yes (IndexedDB) | Mature, simpler |

---

## 10. UX & UI: Surfacing the Sandbox

### 10.1 Design Principles

The knowledge sandbox backend is complex. The UX must be the opposite.

1. **Subscriptions, not databases.** Managing sources should feel like managing a
   reading list or YouTube subscriptions — not administering a graph database.
2. **Provenance is ambient.** Show *where knowledge came from* as inline badges
   and pills, not as separate screens users have to navigate to.
3. **The graph is invisible.** Users never see nodes and edges. They see cards,
   lists, and explanations. The graph is the engine, not the interface.
4. **Why > What.** When the agent recommends something, the UI should surface
   *why* (precedents, sources, reasoning) at the same level as *what*.
5. **Trust builds visually.** Source health, agent track record, and decision
   history should be ambient — always visible, never alarming.

### 10.2 UI Surface Map

Four surfaces, each with a distinct role:

```
NEST > Sources       "What the agent reads"     — manage the sandbox
ROOST > Agent        "What the agent learned"    — see the knowledge
CHICKENS             "Why this draft"            — provenance on cards
POPUP                "Quick pulse"               — source health at a glance
```

### 10.3 Nest > Sources (Manage the Sandbox)

**Location**: New section in Nest tab, alongside Members/Agent/Settings.
Uses existing `collapsible-card` pattern from OperatorConsole.

**Design**: Feels like a reading list / subscriptions page. Each source is a card
with an icon, name, health indicator, and toggle.

```
┌─────────────────────────────────────────────────────┐
│ Sources                                    + Add    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ▶ YouTube Channels (3)                             │
│  ┌─────────────────────────────────────────────┐    │
│  │ ▶ Bankless                                  │    │
│  │   youtube.com/@Bankless · 14 videos indexed  │    │
│  │   Last fetched 2h ago · 47 entities          │    │
│  │   [●] Active            [Refresh] [Remove]   │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ ▶ Lex Fridman                               │    │
│  │   youtube.com/@lexfridman · 8 videos indexed │    │
│  │   Last fetched 1d ago · 31 entities          │    │
│  │   [●] Active            [Refresh] [Remove]   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▶ GitHub Repos (2)                                 │
│  ┌─────────────────────────────────────────────┐    │
│  │ ▶ filecoin-project/specs                    │    │
│  │   github.com · 342 files indexed             │    │
│  │   Last fetched 6h ago · 89 entities          │    │
│  │   [●] Active            [Refresh] [Remove]   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ▶ RSS Feeds (4)                                    │
│  ▶ Subreddits (1)                                   │
│  ▶ NPM Packages (2)                                 │
│                                                     │
│  ─────────────────────────────────────────          │
│  12 sources · 214 entities · 891 relationships      │
│  Graph size: 2.4 MB of 50 MB budget                 │
└─────────────────────────────────────────────────────┘
```

**Add Source flow** (modal or inline):

```
┌─────────────────────────────────────────────────────┐
│ Add a source                                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  What kind?                                         │
│  [YouTube] [GitHub] [RSS] [Reddit] [NPM]            │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │ Channel URL or ID                         │      │
│  │ youtube.com/@Bankless                     │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  The agent will index transcripts from this          │
│  channel and extract knowledge for your coop.        │
│                                                     │
│  [Cancel]                        [Add to sources]   │
└─────────────────────────────────────────────────────┘
```

**Key UX decisions**:
- Source types are first-class tabs, not a freeform URL field — guides users
  to the supported source types, prevents unsandboxed URLs
- Entity count and graph size are visible but not prominent — builds trust
  without overwhelming
- "Last fetched" shows freshness — stale sources surface naturally
- Each source syncs via Yjs — all coop members see the same source list
- Any member can add sources; operator can restrict via policy (future)

**Reuses**: `.collapsible-card`, `.badge`, `.badge-row`, `.field-grid`,
`.primary-button`, `.secondary-button`, `.helper-text`, `.meta-text`

---

### 10.4 Roost > Agent (What the Agent Learned)

**Location**: Extends the existing Agent section in Roost. Currently shows heartbeat,
pending approvals, recent observations, and memories. Adds two new subsections.

**New subsection: "Knowledge"** (below Heartbeat, above Observations)

Shows the agent's current knowledge state — what it knows, from where,
and how confident it is. Not a graph visualization — a topic summary.

```
┌─────────────────────────────────────────────────────┐
│ Knowledge                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Top topics your agent knows about:                 │
│                                                     │
│  Filecoin storage  ████████████░░  82%  (4 sources) │
│  DeFi governance   ██████████░░░░  71%  (3 sources) │
│  ReFi grants       ████████░░░░░░  57%  (2 sources) │
│  Ethereum L2s      ██████░░░░░░░░  43%  (3 sources) │
│  Carbon credits    ████░░░░░░░░░░  29%  (1 source)  │
│                                                     │
│  214 entities · 891 relationships across 12 sources  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**New subsection: "Decision History"** (below Observations)

Shows recent agent decisions with their reasoning traces — the "why"
that Will emphasized. Each entry links back to the source entities and
precedents that informed it.

```
┌─────────────────────────────────────────────────────┐
│ Decision history                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Drafted "Filecoin grant for garden data"      │  │
│  │ [agent insight] [85%] [2h ago]                │  │
│  │                                               │  │
│  │ Based on:                                     │  │
│  │  · Bankless ep. #412 — Filecoin storage costs │  │
│  │  · filecoin-project/specs — FIP-0076          │  │
│  │  · r/ethdev post — grant season timelines     │  │
│  │                                               │  │
│  │ Similar to: "Filecoin archival proposal"      │  │
│  │ (approved 2 weeks ago, acted on)              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Skipped "NFT marketplace listing"             │  │
│  │ [agent insight] [32%] [5h ago]                │  │
│  │                                               │  │
│  │ Based on: Low topic overlap with coop focus   │  │
│  │ Similar to: "OpenSea integration" (rejected)  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Key UX decisions**:
- Topic bars are a simple percentage, not a complex metric — immediately
  scannable. "(4 sources)" shows breadth without detail.
- Decision history entries use the existing `.operator-log-entry` pattern
  with `.badge-row` for metadata.
- "Based on" shows source provenance as a simple bulleted list — each
  bullet is a source the agent actually consulted.
- "Similar to" shows the precedent system at work — the agent is learning
  from past decisions. Status of the precedent (approved/rejected, acted
  on/ignored) is shown so members understand the learning loop.
- Decisions the agent *skipped* are shown too — this builds trust by showing
  restraint, not just activity.

**Reuses**: `.roost-hero-card`, `.roost-activity-list`, `.roost-activity-item`,
`.badge`, `.badge-row`, `.helper-text`, `.meta-text`

---

### 10.5 Chickens Tab (Why This Draft)

**Location**: Enhances the existing DraftCard and ChickensCompactCard.

The DraftCard already shows: stage badge, category badge, provenance badge
("agent insight"), confidence %, and a "Why now" section. The knowledge
sandbox enriches these with graph-backed provenance.

**Enhanced DraftCard provenance** (additions in bold):

```
┌─────────────────────────────────────────────────────┐
│ [hatching] [opportunity] [agent insight] [85%]      │
│                                          3h ago     │
│                                                     │
│ Filecoin Grant for Garden Data Archival             │
│ Your coop's garden maintenance records could        │
│ qualify for the Filecoin Green Data Commons grant.   │
│                                                     │
│ filecoin.io · 3 sources · 1 coop target             │
│                                                     │
│ ╔═══════════════════════════════════════════════╗    │
│ ║ Sourced from                                  ║    │
│ ║  · Bankless #412 — "Filecoin storage costs"   ║    │
│ ║  · filecoin-project/specs — FIP-0076          ║    │
│ ║  · Filecoin Blog (RSS) — "Green Data Commons" ║    │
│ ║                                               ║    │
│ ║ Track record                                  ║    │
│ ║  Similar draft approved 2 weeks ago → acted on ║    │
│ ╚═══════════════════════════════════════════════╝    │
│                                                     │
│ Why now                                             │
│ Grant application window opens next week.            │
│ Your garden data is already archive-worthy.          │
│                                                     │
│ Next move                                           │
│ Review garden data completeness before applying.     │
│                                                     │
│ [Polish locally] [Save] [Mark worth saving]         │
│ [Ready to share]                    [Open source]   │
└─────────────────────────────────────────────────────┘
```

**What changes on the DraftCard**:

1. **"Sourced from" section** (new, between meta strip and "Why now"):
   - Only appears for agent-generated drafts (provenance === 'agent')
   - Shows 1-3 source references that the agent actually consulted
   - Each reference: source name + specific content (video title, file name, article title)
   - Collapsible if space is tight (default collapsed on compact cards)

2. **"Track record" line** (new, within Sourced from):
   - Shows the most relevant precedent decision
   - "Similar draft approved X ago → acted on" (green, positive)
   - "Similar draft rejected X ago" (muted, informational)
   - Only appears if a precedent exists in the graph

3. **Confidence badge gets richer context**:
   - Currently: "85% match" (static number)
   - Enhanced: tooltip on hover shows breakdown:
     "Schema: 95% · Content: 82% · Precedent: +8% boost"
   - Precedent boost/penalty is visible — members see the learning effect

**Compact card (ChickensCompactCard)** — lighter touch:
- Add source icon (YouTube/GitHub/RSS icon) next to provenance badge
- No "Sourced from" section (too much for compact view)
- Precedent indicator: small green/neutral dot next to confidence

**Key UX decisions**:
- "Sourced from" only on agent-generated drafts — tab captures and receiver
  captures already have clear provenance (the source URL)
- Sources show *specific content*, not just source name — "Bankless #412"
  not just "Bankless." This makes provenance verifiable.
- Track record is one line, not a list — simplest possible precedent display
- Confidence breakdown is a tooltip, not inline — keeps the card clean while
  making the reasoning available on demand

---

### 10.6 Popup (Quick Pulse)

**Location**: Extends PopupHomeScreen with a subtle source health indicator.

The popup is for quick capture, not deep exploration. Source health should
be ambient — visible without interaction.

**Source health indicator** (in PopupProfilePanel or header area):

```
┌─────────────────────────────────────────┐
│  Coop Name                        ⚙     │
│                                         │
│  [Roundup chickens]                     │
│                                         │
│  Sources: 12 active · all fresh  ●      │
│  (or)                                   │
│  Sources: 11 active · 1 stale   ●       │
│                                         │
└─────────────────────────────────────────┘
```

**Key UX decisions**:
- One line, one dot (green/yellow/red) — zero cognitive load
- "All fresh" vs "1 stale" — actionable without being alarming
- Clicking the line opens Nest > Sources in the sidepanel
- No source management in the popup — that complexity lives in Nest

---

### 10.7 Key UX Flows

**Flow 1: First source added (onboarding)**

```
Member opens Nest > Sources → empty state:

  "Your agent doesn't have any knowledge sources yet.
   Add a YouTube channel, GitHub repo, or RSS feed to
   give it something to learn from."

  [+ Add your first source]

Member adds youtube.com/@Bankless:
  → Inline progress: "Indexing latest videos..."
  → Complete: "12 videos indexed · 47 entities found"
  → Toast: "Your agent will now use Bankless content
     when creating draft recommendations."
```

**Flow 2: Agent creates a graph-enhanced draft**

```
Agent observation fires → skill pipeline runs →
entity extraction finds relevant entities in graph →
opportunity-extractor uses graph context →
draft created with source references attached →

Draft appears in Chickens with "Sourced from" section →
Member reads sources, sees track record →
Member approves → published to coop →

Reasoning trace recorded as precedent →
Next similar draft gets confidence boost
```

**Flow 3: Member questions a recommendation**

```
Member sees draft with 72% confidence →
Hovers confidence badge →
Tooltip: "Schema: 90% · Content: 68% · No precedent" →

Opens Roost > Agent > Decision History →
Sees the reasoning trace:
  "Based on: RSS article + GitHub issue. No similar
   past decisions found. Lower confidence because
   topic overlap with coop focus is moderate." →

Member has enough context to approve or reject →
Decision recorded → becomes precedent for next time
```

**Flow 4: Source becomes stale**

```
RSS feed hasn't updated in 14 days →
Source card shows "Last fetched 14d ago" in yellow →

Popup shows "Sources: 11 active · 1 stale" →
Member opens Nest > Sources →
Sees stale source → clicks Refresh or Remove →

If removed: entities from that source are marked
as historical (not deleted — temporal validity) →
Agent stops using them for new recommendations
but they remain as historical context
```

---

### 10.8 New Shared Components

```
shared/SourceBadge.tsx
  — Small pill showing source type icon + name
  — Used in DraftCard "Sourced from" and Nest source list
  — Props: { type: 'youtube' | 'github' | 'rss' | 'reddit' | 'npm', name: string }

shared/PrecedentIndicator.tsx
  — One-line precedent display
  — "Similar draft approved 2w ago → acted on" or "No precedent"
  — Props: { precedent: { decision, outcome, timeAgo } | null }

shared/TopicBar.tsx
  — Horizontal bar chart for topic knowledge depth
  — Props: { topic: string, depth: number, sourceCount: number }
  — Used in Roost > Agent > Knowledge section

shared/ConfidenceTooltip.tsx
  — Wraps existing confidence badge with hover breakdown
  — Props: { schema: number, content: number, precedentDelta: number }
  — Uses existing Tooltip component
```

**CSS additions** (extend `global.css`):

```css
/* Source provenance section on draft cards */
.draft-card__provenance { ... }         /* bordered section */
.draft-card__source-ref { ... }         /* single source line */
.draft-card__track-record { ... }       /* precedent line */

/* Source management in Nest */
.source-card { ... }                    /* extends .operator-log-entry */
.source-card__health { ... }            /* freshness indicator */
.source-card__stats { ... }             /* entity/relationship counts */

/* Topic knowledge bars in Roost */
.topic-bar { ... }                      /* horizontal bar chart */
.topic-bar__fill { ... }                /* filled portion */

/* Source type icons */
.source-icon--youtube { ... }
.source-icon--github { ... }
.source-icon--rss { ... }
.source-icon--reddit { ... }
.source-icon--npm { ... }
```

---

### 10.9 UX Testing Plan

Each UI component gets tested at two levels:

**Unit (Vitest + Testing Library)**:
- SourceBadge renders correct icon for each type
- PrecedentIndicator shows positive/negative/null states
- TopicBar renders correct fill percentage
- ConfidenceTooltip shows breakdown on hover
- Nest Sources section: add, remove, refresh, toggle active
- DraftCard with provenance data shows "Sourced from" section
- DraftCard without provenance data hides section

**E2E (Playwright)**:
- Member adds a source in Nest → source appears in list
- Agent creates draft → draft card shows source references
- Member hovers confidence → tooltip appears with breakdown
- Roost Agent section shows knowledge topics
- Popup shows source health indicator
- Source removal → entity freshness updates in graph

**Visual Regression (Snapshot)**:
- DraftCard with/without provenance section
- Source card in different states (active, stale, disabled)
- Topic bars at various fill levels
- Empty states for sources and knowledge sections

---

## 11. Neo4j Context Graph Talk — Key Insights (Video Notes)

**Source**: Will (PM, Neo4j AI Innovation) at Context Graph Meetup
**Video**: https://youtu.be/qMV64p-4Deo

This talk directly validates the graph memory architecture and adds several concepts we
should adopt.

### 10.1 The "Missing Why"

The core thesis of context graphs: **a knowledge graph that captures not just what happened
but _why_ decisions were made**. Foundation Capital called this a "trillion-dollar opportunity."

For Coop: when the agent recommends publishing a draft or approving a transaction, the graph
should capture the full reasoning chain — which sources informed it, which policies applied,
which precedents existed. This transforms the agent from a black-box recommender into an
auditable decision-maker.

### 10.2 Three Memory Types (Neo4j Agent Memory)

Will's framework maps cleanly to our three-tier model but adds critical implementation detail:

| Neo4j Term | Our Term | Key Insight |
|------------|----------|-------------|
| **Short-term** (conversation, session state, working memory) | Episodic | Saving a message kicks off **background entity extraction** — this is the bridge from short-term to long-term. Not blocking. |
| **Long-term** (entities, relationships, facts extracted from messages) | Semantic | Uses POLE+O model (same as our proposed model). Domain-specific extraction schemas are critical — extract financial entities for finance, not vacation plans. |
| **Reasoning** (tool call traces, decision steps, precedents) | Procedural | **This is the piece most agent memory systems miss.** Recording which tools were called, what was retrieved, what tokens were used. Decisions serve as precedent for future decisions. |

The reasoning memory insight is huge for Coop: when the agent makes a publish recommendation,
that reasoning trace (which skill ran, what context was retrieved, what confidence score)
becomes a **precedent node** in the graph. Future similar decisions can reference it.

### 10.3 Entity Extraction Pipeline (Critical for Browser)

Will emphasized that **LLM-only entity extraction is too slow and expensive**. Their pipeline:

```
Message text
  → NER (spaCy-style statistical methods) — fast, CPU, catches obvious entities
  → GLiNER 2 (small local model, CPU) — fine-tuned for entity + relationship extraction
  → LLM fallback — only for complex cases the smaller models miss
```

**Direct Coop analog**: This maps to our existing 3-tier inference cascade:
- Tier 1: WebLLM (local GPU) → equivalent to their GLiNER stage
- Tier 2: Transformers.js (CPU WASM) → equivalent to their spaCy/NER stage
- Tier 3: Heuristic → their statistical methods

We should build entity extraction as a **new skill** that uses the cascade, not as a
separate pipeline. The existing `theme-clusterer` and `ecosystem-entity-extractor` skills
already do lightweight versions of this.

### 10.4 Graph Embeddings (Beyond Text)

This is the most technically important insight for Coop:

**Text embeddings** capture semantic similarity ("what does this text mean?")
**Graph embeddings** (FastRP algorithm) capture **structural similarity** ("what patterns
exist in how this entity connects to others?")

Example: two accounts that have similar transaction patterns to known fraud networks will
have similar graph embeddings, even if their text descriptions are completely different.

For Coop: graph embeddings on the knowledge graph would let the agent find structurally
similar patterns — "this grant opportunity connects to our domain the same way that previous
successful grant did" — not just textually similar content.

**Hybrid search** = text embedding similarity + graph embedding similarity + graph traversal.
This is more powerful than what Zep/Graphiti describes (which focuses on text + BM25 + traversal).

### 10.5 Enrichment Pattern

Will showed how extracted location entities get automatically enriched with Wikipedia data
and geocoded. This pattern applies directly to Coop's source adapters:

```
YouTube transcript → extract "Filecoin" entity
  → enrich from allowlisted GitHub repo (filecoin-project/specs)
  → enrich from allowlisted RSS feed (Filecoin blog)
  → result: rich entity node with cross-source context
```

Sources don't just feed the graph independently — they **enrich each other**. An entity
mentioned in a YouTube transcript gets deeper context from a GitHub repo the coop also
follows. This is where the allowlisted source registry becomes more than security — it
becomes a **knowledge amplifier**.

### 10.6 Shared Memory Across Agent Swarms

Will demoed multiple specialized agents (AML, compliance, customer service) all reading from
and writing to a **shared Neo4j agent memory layer**. Each agent has its own persona but they
share the same knowledge graph.

For Coop: this maps to inter-coop agent communication (Agent Evolution Workstream 2). When
coop A's agent writes a reasoning trace about a grant opportunity, coop B's agent (if they
share sources) can reference that reasoning as context. The shared graph IS the communication
medium — not just message passing.

### 10.7 Lenny's Podcast Example = Our YouTube Pipeline

Will took Lenny's Podcast transcripts, ran them through Neo4j Agent Memory as if they were
agent conversations, and built a queryable context graph. **This is exactly the YouTube
channel → knowledge graph pipeline we're proposing.**

The key difference: they used Neo4j server-side. We'd use Kuzu-WASM browser-side. But the
pattern is identical:

```
Podcast/YouTube transcript
  → Entity extraction (POLE+O model)
  → Graph construction (entities + relationships)
  → Enrichment (geocoding, Wikipedia, cross-reference)
  → Queryable context graph
  → Agent uses graph for RAG-style retrieval
```

### 10.8 Context Graph Demo Architecture

The financial services demo showed a **context graph agent** that:
1. Receives a request (e.g., credit limit increase for customer X)
2. Searches the graph for the customer and their context
3. Traverses to find relevant policies, precedents, fraud flags
4. Uses hybrid search (vector + graph) to find similar past decisions
5. Makes a recommendation with full reasoning trace
6. **Records the decision back to the graph** as a new precedent node

This record-back pattern is essential for Coop: every agent action should write its reasoning
trace back to the graph, creating institutional memory that compounds over time.

---

## 12. TDD, Evaluation & Outcome-Based Build Plan

### 12.1 Build Philosophy

Every module ships with **tests before implementation** (red-green-refactor), **eval cases
that define success** (not just "it works" but "it works well enough"), and **outcome metrics
that prove value** (not just coverage numbers but measurable quality improvements). No module
merges without all three.

The existing test infrastructure is strong: Vitest with 85% coverage thresholds, Playwright
E2E, 50+ named validation suites, factory patterns, real Dexie on fake-indexeddb. We extend
it rather than replace it.

### 12.2 Build Phases (Dependency-Ordered)

Each phase has a **gate** — the validation suite that must pass before the next phase begins.

```
Phase 1: Source Registry          (foundation — no external deps)
Phase 2: Source Adapters          (depends on Phase 1 registry)
Phase 3: Entity Extraction Skill  (depends on Phase 2 adapter output)
Phase 4: Graph Memory Layer       (depends on Phase 3 entities)
Phase 5: Graph Retrieval          (depends on Phase 4 graph)
Phase 6: Reasoning Traces         (depends on Phase 5 retrieval)
Phase 7: Integration              (wires everything into the agent pipeline)
```

---

### Phase 1: Source Registry

**What**: Dexie table + Yjs sync for allowlisted knowledge sources per coop.

**TDD Cycle**:

```
RED (write tests first):
  ├── source-registry.test.ts
  │   ├── createKnowledgeSource() stores to Dexie with correct schema
  │   ├── removeKnowledgeSource() deletes and cascades to ingested content
  │   ├── listKnowledgeSources() filters by coop, type, active status
  │   ├── assertAllowedSource() passes for registered sources
  │   ├── assertAllowedSource() throws for unregistered URLs
  │   ├── assertAllowedSource() throws for denylist (private IPs, credentials)
  │   ├── assertAllowedSource() handles edge cases (subdomains, path traversal)
  │   └── duplicate source detection by normalized identifier
  │
  ├── source-registry-sync.test.ts
  │   ├── sources sync to Y.Map('knowledge-sources-v1')
  │   ├── concurrent add from two peers merges correctly
  │   ├── remove propagates to peers
  │   └── offline add syncs on reconnect
  │
  └── source-registry-fixtures.ts
      ├── makeKnowledgeSource({type: 'youtube', identifier: 'UCxxx', ...})
      ├── makeKnowledgeSource({type: 'github', identifier: 'org/repo', ...})
      └── makeKnowledgeSource({type: 'rss', identifier: 'https://...', ...})

GREEN: Minimal implementation
  ├── schema-knowledge.ts (Zod schemas for KnowledgeSource)
  ├── knowledge-source.ts (CRUD + assertAllowedSource)
  └── sync-knowledge-sources.ts (Y.Map binding)

REFACTOR: Extract shared URL normalization, align with assertSafeSkillUrl()
```

**Eval criteria**:
- 100% of denylist entries blocked (security-critical, no exceptions)
- Source CRUD round-trips through Dexie without data loss
- Y.Map sync converges within 3 Yjs updates

**Outcome metric**: `assertAllowedSource()` replaces `assertSafeSkillUrl()` as the single
enforcement point for all external fetches.

**Gate**: `bun run validate quick` + new `unit:knowledge-registry` suite passes

---

### Phase 2: Source Adapters

**What**: Type-specific adapters that fetch content from allowlisted sources.

**TDD Cycle**:

```
RED:
  ├── adapter-youtube.test.ts
  │   ├── fetchYouTubeTranscript() returns structured transcript for valid video
  │   ├── fetchYouTubeTranscript() throws for non-allowlisted channel
  │   ├── fetchYouTubeTranscript() handles missing captions gracefully
  │   ├── fetchYouTubeTranscript() respects rate limiting
  │   └── parseTranscriptSegments() chunks into time-stamped paragraphs
  │
  ├── adapter-github.test.ts
  │   ├── fetchGitHubRepoContext() returns README + package.json + tree
  │   ├── fetchGitHubRepoContext() throws for non-allowlisted repo
  │   ├── fetchGitHubRepoContext() handles private/archived repos
  │   └── fetchGitHubFileContent() fetches specific file by path
  │
  ├── adapter-rss.test.ts
  │   ├── fetchRSSFeed() returns parsed articles with metadata
  │   ├── fetchRSSFeed() throws for non-allowlisted feed URL
  │   ├── fetchRSSFeed() handles Atom, RSS 2.0, and JSON Feed formats
  │   ├── fetchRSSFeed() deduplicates by article GUID
  │   └── fetchRSSFeed() returns only new items since last fetch
  │
  ├── adapter-reddit.test.ts
  │   ├── fetchRedditPosts() returns posts with top comments
  │   ├── fetchRedditPosts() throws for non-allowlisted subreddit
  │   └── fetchRedditPosts() sanitizes user-generated content
  │
  ├── adapter-npm.test.ts
  │   ├── fetchNPMPackageInfo() returns metadata + README
  │   ├── fetchNPMPackageInfo() throws for non-allowlisted package
  │   └── fetchNPMPackageInfo() handles scoped packages (@org/pkg)
  │
  └── adapter-sanitizer.test.ts (shared across all adapters)
      ├── sanitizeIngested() strips prompt injection patterns
      ├── sanitizeIngested() preserves legitimate markdown
      ├── sanitizeIngested() truncates content above size limit
      └── sanitizeIngested() detects and flags suspicious content

GREEN: Each adapter is a pure function: (source, registry) → StructuredContent | Error
  ├── adapters/youtube.ts
  ├── adapters/github.ts
  ├── adapters/rss.ts
  ├── adapters/reddit.ts
  ├── adapters/npm.ts
  └── adapters/sanitizer.ts

REFACTOR: Extract common adapter interface, shared retry/timeout, content size limits
```

**Eval criteria** (per adapter):
- Passes with real API response fixtures (recorded, not live)
- Correctly rejects non-allowlisted sources (no false positives)
- Sanitizer catches 100% of known prompt injection patterns from test corpus
- Content extraction preserves key information (title, body, metadata, author)

**Outcome metric**: Each adapter has ≥3 recorded API response fixtures covering
happy path, error cases, and edge cases. Adapters are pure functions with no side effects.

**Gate**: `unit:knowledge-adapters` suite passes + sanitizer coverage at 100%

---

### Phase 3: Entity Extraction Skill

**What**: New agent skill that extracts POLE+O entities from ingested source content,
using the existing 3-tier inference cascade.

**TDD Cycle**:

```
RED:
  ├── skill-entity-extractor.test.ts
  │   ├── Heuristic tier: NER-style extraction finds named entities in text
  │   ├── Heuristic tier: returns empty for content with no extractable entities
  │   ├── Transformers tier: extracts entities + relationships from paragraph
  │   ├── Transformers tier: categorizes entities into POLE+O types
  │   ├── Transformers tier: outputs valid EntityExtractionOutput schema
  │   ├── WebLLM tier: handles complex multi-entity paragraphs
  │   ├── Cascade: falls through tiers correctly on failure
  │   └── Cascade: heuristic cold-start fallback works (no blocking)
  │
  ├── entity-extraction-eval/
  │   ├── youtube-transcript-sample.json (eval case: extract from podcast excerpt)
  │   ├── github-readme-sample.json (eval case: extract from repo README)
  │   ├── rss-article-sample.json (eval case: extract from blog post)
  │   └── mixed-source-sample.json (eval case: multi-source enrichment)
  │
  └── entity-extraction-quality.test.ts
      ├── computeEntityExtractionConfidence() scores based on entity count + types
      ├── confidence increases with relationship count
      ├── confidence decreases for untyped/unknown entities
      └── confidence floor at 0.2 for any non-empty output

GREEN:
  ├── skills/entity-extractor/ (skill manifest + prompt + output schema)
  ├── schema-agent.ts additions (EntityExtractionOutput, entity types)
  └── quality.ts additions (confidence scoring for entity extraction)

REFACTOR: Share extraction patterns with existing ecosystem-entity-extractor
```

**Eval criteria** (using existing eval framework):
```typescript
// Entity extraction eval assertions
assertions: [
  {type: 'array-min-length', path: 'entities', threshold: 1},
  {type: 'field-present', path: 'entities[0].type'},
  {type: 'field-present', path: 'entities[0].name'},
  {type: 'field-equals', path: 'entities[0].type',
   expected: ['person', 'organization', 'location', 'event', 'object']},
  {type: 'array-min-length', path: 'relationships', threshold: 0},
  {type: 'semantic-word-count', path: 'entities[0].description', threshold: 3},
]
qualityScore formula: 0.2 * schema + 0.3 * structural + 0.5 * semantic
threshold: 0.6 (passing)
```

**Outcome metrics**:
- Precision: ≥70% of extracted entities are real entities (not noise)
- Recall: ≥50% of known entities in test corpus are found
- POLE+O coverage: ≥3 of 5 entity types populated per multi-topic source
- Cascade efficiency: ≥60% of extractions complete at Tier 2 (Transformers), not Tier 3

**Gate**: `unit:entity-extraction` + eval cases pass at threshold ≥0.6

---

### Phase 4: Graph Memory Layer

**What**: Kuzu-WASM integration for storing entities and relationships with temporal edges.

**TDD Cycle**:

```
RED:
  ├── graph-store.test.ts
  │   ├── initGraphStore() creates Kuzu-WASM instance with IDBFS persistence
  │   ├── initGraphStore() creates POLE+O node tables and edge tables
  │   ├── upsertEntity() inserts new entity node
  │   ├── upsertEntity() updates existing entity (same name+type = merge)
  │   ├── upsertEntity() preserves temporal history on update
  │   ├── createRelationship() adds typed edge between entities
  │   ├── createRelationship() sets validity window (t_valid, t_invalid)
  │   ├── invalidateRelationship() sets t_invalid without deleting
  │   ├── getEntity() retrieves entity with all edges
  │   ├── getEntityNeighbors() returns 1-hop connected entities
  │   └── destroyGraphStore() cleans up WASM resources
  │
  ├── graph-temporal.test.ts
  │   ├── currentFacts() returns only edges where t_invalid is null
  │   ├── factsAt(timestamp) returns edges valid at that point in time
  │   ├── factHistory(entityId) returns full temporal timeline
  │   ├── conflicting facts detected (same relationship, different values)
  │   └── newer fact auto-invalidates older contradicting fact
  │
  ├── graph-persistence.test.ts
  │   ├── graph survives store close + reopen (IDBFS round-trip)
  │   ├── graph handles concurrent read/write (single-writer safety)
  │   ├── graph respects storage quota limits gracefully
  │   └── graph migration path (v1 → v2 schema changes)
  │
  └── graph-store-fixtures.ts
      ├── makeEntity({type: 'person', name: 'Vitalik', ...})
      ├── makeRelationship({from, to, type: 'founded', t_valid, ...})
      └── seedTestGraph() (small connected graph for traversal tests)

GREEN:
  ├── graph/store.ts (Kuzu-WASM lifecycle + CRUD)
  ├── graph/schema.ts (Cypher DDL for POLE+O tables)
  ├── graph/temporal.ts (validity window logic)
  └── graph/persistence.ts (IDBFS init + teardown)

REFACTOR: Optimize Cypher queries, add query plan caching
```

**Eval criteria**:
- CRUD round-trip: entity survives write → close → reopen → read
- Temporal correctness: `currentFacts()` never returns invalidated edges
- Performance: 100-entity graph queries complete in <50ms
- Memory: graph with 1000 entities + 5000 edges stays under 10MB IndexedDB

**Outcome metrics**:
- Zero data loss on IDBFS round-trip (100% of entities recoverable)
- Temporal query correctness: 100% (this is a correctness requirement, not a target)
- P95 query latency <50ms for graphs up to 1000 entities

**Gate**: `unit:graph-store` passes + IDBFS persistence tests pass on fake-indexeddb

---

### Phase 5: Graph Retrieval

**What**: Hybrid search combining vector similarity, BM25, and graph traversal.

**TDD Cycle**:

```
RED:
  ├── graph-retrieval.test.ts
  │   ├── searchByText() returns entities matching BM25 full-text query
  │   ├── searchByVector() returns entities by embedding cosine similarity
  │   ├── searchByTraversal() returns 1-hop and 2-hop neighbors
  │   ├── hybridSearch() combines all three with configurable weights
  │   ├── hybridSearch() deduplicates across search methods
  │   ├── hybridSearch() respects temporal validity (only current facts)
  │   ├── hybridSearch() returns results with provenance (which source)
  │   └── hybridSearch() completes without LLM call (retrieval-only)
  │
  ├── graph-retrieval-relevance.test.ts (quality benchmarks)
  │   ├── Given seeded graph with known entities:
  │   │   ├── query "Filecoin storage" returns Filecoin entity in top 3
  │   │   ├── query "grant opportunities" returns grant-related entities
  │   │   ├── unrelated query returns empty or low-confidence results
  │   │   └── graph neighbors of top result add useful context
  │   │
  │   └── Retrieval does NOT trigger any inference provider
  │
  ├── graph-embedding.test.ts
  │   ├── generateEntityEmbedding() returns fixed-dim vector for text
  │   ├── embeddings use Transformers.js tier (CPU, no GPU required)
  │   ├── embedding generation batches efficiently (≤50ms for 10 entities)
  │   └── embedding cache prevents redundant computation
  │
  └── graph-context-assembly.test.ts
      ├── assembleGraphContext() formats retrieval results for skill prompt
      ├── assembleGraphContext() respects token budget (truncates, not drops)
      ├── assembleGraphContext() includes provenance metadata
      └── assembleGraphContext() prioritizes by relevance score

GREEN:
  ├── graph/retrieval.ts (hybrid search orchestration)
  ├── graph/embedding.ts (Transformers.js vector generation)
  └── graph/context.ts (context assembly for skill prompts)

REFACTOR: Tune hybrid search weights based on relevance benchmarks
```

**Eval criteria**:
- Relevance: top-3 results for known queries match expected entities ≥80% of the time
- Latency: hybrid search completes in <200ms for graphs up to 1000 entities
- No LLM calls during retrieval (hard requirement — verified via mock assertions)
- Context assembly stays within 2000 token budget

**Outcome metrics**:
- Mean Reciprocal Rank (MRR) ≥0.6 on test corpus of 20 queries
- Zero LLM invocations during retrieval (enforced by test, not just measured)
- Graph context improves skill output quality by ≥10% vs flat memory retrieval
  (measured by running existing eval cases with graph context vs without)

**Gate**: `unit:graph-retrieval` + relevance benchmark passes MRR ≥0.6

---

### Phase 6: Reasoning Traces

**What**: Record agent decision traces as precedent nodes in the graph.

**TDD Cycle**:

```
RED:
  ├── reasoning-trace.test.ts
  │   ├── recordReasoningTrace() creates trace node linked to skill run
  │   ├── recordReasoningTrace() captures: tool calls, context retrieved,
  │   │   confidence score, output summary, outcome
  │   ├── recordReasoningTrace() links to source entities used
  │   ├── recordReasoningTrace() links to precedent traces referenced
  │   ├── queryPrecedents() finds traces for similar observations
  │   ├── queryPrecedents() ranks by outcome (successful > failed)
  │   ├── queryPrecedents() respects temporal recency
  │   └── traceCount() tracks graph growth for quota enforcement
  │
  ├── reasoning-precedent.test.ts
  │   ├── Given: agent approved draft X → recorded as positive precedent
  │   │   When: similar draft Y arrives
  │   │   Then: precedent for X surfaces in context
  │   │
  │   ├── Given: agent rejected draft X → recorded as negative precedent
  │   │   When: similar draft Y arrives
  │   │   Then: rejection precedent informs lower confidence
  │   │
  │   └── Given: conflicting precedents (approve + reject similar drafts)
  │       Then: both surface with outcome labels, agent weighs them
  │
  └── reasoning-trace-eval/
      ├── publish-decision-trace.json (eval: trace for publish recommendation)
      └── grant-recommendation-trace.json (eval: trace for grant scoring)

GREEN:
  ├── graph/reasoning.ts (trace CRUD + precedent queries)
  └── runner-skills-completion.ts modifications (write trace after skill run)

REFACTOR: Optimize precedent query to avoid full graph scan
```

**Eval criteria**:
- Trace → precedent round-trip: recorded trace appears in future similar queries
- Outcome labeling: positive/negative precedents correctly tagged
- Precedent retrieval latency: <100ms for graphs with up to 500 traces

**Outcome metrics**:
- Agent confidence adjustment: drafts similar to past successes get ≥0.05 confidence boost
- Agent confidence adjustment: drafts similar to past failures get ≥0.05 confidence decrease
- Precedent utilization rate: ≥30% of skill runs retrieve at least one relevant precedent
  (after 50+ reasoning traces accumulated)

**Gate**: `unit:reasoning-traces` + precedent relevance tests pass

---

### Phase 7: Integration

**What**: Wire the full pipeline into the existing agent observation → plan → execute cycle.

**TDD Cycle**:

```
RED:
  ├── knowledge-sandbox-integration.test.ts
  │   ├── Full cycle: source added → adapter fetches → entities extracted →
  │   │   graph populated → skill retrieves context → output improves
  │   │
  │   ├── Source removal cascades: remove source → its entities marked stale
  │   ├── Allowlist enforcement end-to-end: non-registered URL blocked at fetch
  │   ├── Memory migration: flat agentMemories coexist with graph during transition
  │   └── Agent observation triggers graph retrieval (not just Dexie query)
  │
  ├── knowledge-sandbox-regression.test.ts
  │   ├── Existing 16 skills produce same or better output with graph context
  │   ├── Existing eval cases still pass (no regression)
  │   ├── Existing observation triggers still work
  │   ├── Existing memory queries still return results (backwards compat)
  │   └── Agent cycle time does not increase by >20%
  │
  └── e2e/knowledge-sandbox.spec.cjs (Playwright)
      ├── Member adds YouTube channel source in Nest settings
      ├── Agent ingests transcript from allowlisted channel
      ├── Agent uses ingested knowledge in next skill run
      ├── Member removes source → agent no longer accesses it
      └── Non-allowlisted URL fetch is blocked (visible error)

GREEN: Wire adapters into observation triggers, graph into skill context assembly

REFACTOR: Performance tune the full pipeline
```

**Eval criteria** (regression suite):
- All existing eval cases pass at their current thresholds (zero regression)
- All existing unit tests pass (zero regression)
- Agent cycle time (observation → plan complete) stays within 120% of baseline
- New eval cases for graph-enhanced skills pass at threshold ≥0.6

**Outcome metrics** (the real measure of success):
- Skill output quality: ≥10% improvement in qualityScore for skills that use graph context
  vs the same skills with flat memory only (A/B measured on eval corpus)
- Agent memory richness: graph contains ≥3x more queryable relationships than flat table
  (entity count × average edge count vs flat memory record count)
- Decision explainability: every agent recommendation can trace back to specific source
  entities and precedent decisions in the graph

**Gate**: `bun run validate smoke` + `unit:knowledge-sandbox-integration` + zero regression
on existing eval cases

---

### 12.3 Validation Suite Additions

New named suites for `scripts/validate.ts`:

```typescript
// Individual module suites
'unit:knowledge-registry':    ['vitest packages/shared/src/modules/knowledge/__tests__/'],
'unit:knowledge-adapters':    ['vitest packages/shared/src/modules/knowledge/adapters/__tests__/'],
'unit:entity-extraction':     ['vitest packages/extension/src/runtime/__tests__/entity-extraction*'],
'unit:graph-store':            ['vitest packages/shared/src/modules/graph/__tests__/'],
'unit:graph-retrieval':        ['vitest packages/shared/src/modules/graph/__tests__/retrieval*'],
'unit:reasoning-traces':       ['vitest packages/shared/src/modules/graph/__tests__/reasoning*'],

// Integration suites
'unit:knowledge-sandbox-integration': [
  'unit:knowledge-registry',
  'unit:knowledge-adapters',
  'unit:entity-extraction',
  'unit:graph-store',
  'unit:graph-retrieval',
  'unit:reasoning-traces',
],

// Composite suite (add to existing validate.ts)
'knowledge-sandbox': [
  'lint',
  'unit:knowledge-sandbox-integration',
  'build',
  'e2e:knowledge-sandbox',
],
```

### 12.4 Eval Case Structure

Each phase produces eval cases that persist as regression tests:

```
packages/extension/src/skills/entity-extractor/eval/
  ├── youtube-transcript-sample.json
  ├── github-readme-sample.json
  ├── rss-article-sample.json
  └── mixed-source-sample.json

packages/shared/src/modules/graph/__tests__/benchmarks/
  ├── retrieval-relevance-corpus.json  (20 queries + expected top-3)
  ├── temporal-correctness-corpus.json (fact lifecycle scenarios)
  └── precedent-matching-corpus.json   (decision similarity scenarios)
```

Eval cases are **golden fixtures** — they define what "good" looks like and never
regress. When the implementation improves, thresholds can be raised but never lowered.

### 12.5 Quality Scoring Extensions

Extend the existing `computeOutputConfidence()` in `quality.ts`:

```typescript
// New output type confidence scoring
'entity-extraction-output': (output, provider) => {
  let score = provider === 'heuristic' ? 0.25 : 0.4;
  score += Math.min(output.entities.length * 0.05, 0.25);  // entity count
  score += Math.min(output.relationships.length * 0.03, 0.15);  // relationship count
  score += output.entities.some(e => e.type !== 'object') ? 0.1 : 0;  // type diversity
  score += output.entities.every(e => e.description?.length > 10) ? 0.1 : 0;  // descriptions
  return clamp(score, 0.2, 0.95);
}
```

Extend the existing eval assertion types:

```typescript
// New assertion types for graph-backed evaluation
{type: 'graph-entity-exists', entityName: string, entityType: PoleType}
{type: 'graph-edge-exists', from: string, to: string, relationType: string}
{type: 'graph-temporal-valid', entityName: string, asOf: string}
{type: 'precedent-retrieved', traceType: string, minCount: number}
```

### 12.6 Regression Prevention Contract

Before any phase merges to main:

| Check | Command | Must Pass |
|-------|---------|-----------|
| Types | `bun run validate typecheck` | Zero errors |
| Lint | `bun format && bun lint` | Zero warnings |
| Phase tests | `bun run validate unit:knowledge-{phase}` | 100% pass |
| Existing tests | `bun run test` | Zero regressions vs baseline |
| Existing evals | Phase 7 only: all skill eval cases | At or above current thresholds |
| Build | `bun build` | Clean build |
| Coverage | Phase-specific coverage ≥80% | Lines, functions, statements |

### 12.7 A/B Evaluation Protocol

The ultimate proof that graph memory improves agent quality:

```
1. Baseline capture (before integration):
   - Run all skill eval cases with current flat memory
   - Record qualityScore per skill per eval case
   - Record confidence per skill per eval case
   - Save as baseline-flat-memory.json

2. Graph-enhanced run (after Phase 7):
   - Seed graph with test corpus (same sources as eval fixtures)
   - Run all skill eval cases with graph retrieval active
   - Record qualityScore per skill per eval case
   - Record confidence per skill per eval case
   - Save as result-graph-memory.json

3. Compare:
   - Per-skill delta in qualityScore (target: ≥10% improvement)
   - Per-skill delta in confidence (target: directionally correct)
   - Any regressions flagged for investigation
   - Publish comparison as eval/graph-memory-ab-report.json
```

---

## 13. Open Questions

1. **Kuzu-WASM in MV3 offscreen documents**: Has anyone tested WASM memory constraints in
   Chrome's offscreen document context? The 4MB binary + graph data could hit limits.

2. **Graph sync across peers**: Should the knowledge graph sync via Yjs like other coop
   state? Or is it per-device (each member's agent builds its own graph from shared sources)?

3. **Source adapter security**: YouTube/Reddit APIs can return user-generated content with
   prompt injection attempts. How do we sanitize ingested content before it enters the graph?

4. **Embedding generation**: Kuzu supports vector indexes, but generating embeddings
   in-browser for all ingested content adds compute cost. Use the existing Transformers.js
   tier? Or pre-compute during idle time?

5. **Neo4j vs Kuzu for server-side**: If Coop adds a server-side agent (trusted node / operator
   runtime), Neo4j with their agent-memory package would be the natural choice. Should we
   design the schema to be portable between Kuzu (browser) and Neo4j (server)?

6. **Reddit API access**: Reddit's API has become increasingly restrictive. Is the JSON API
   (`/r/{sub}/hot.json`) still viable for bot access, or do we need OAuth?

7. **Cross-coop knowledge sharing**: Can coops share their source registries? "Our coop
   trusts these 15 YouTube channels — want to import our list?"

8. **Graph embeddings in-browser**: Neo4j uses FastRP for structural embeddings. Does
   Kuzu-WASM support graph embedding algorithms, or would we need to implement FastRP
   ourselves? This is the difference between text-only and structural similarity search.

9. **Reasoning memory as precedent**: How do we handle conflicting precedents? If two past
   decisions about similar grants went different ways, how does the agent weigh them?

10. **Enrichment across sources**: When should cross-source enrichment happen — at ingestion
    time (eager) or at retrieval time (lazy)? Eager is more complete but slower; lazy is
    faster but may miss connections.

---

## 14. Karpathy's LLM Wiki — Pattern Alignment

**Source**: [Andrej Karpathy's LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) (2026-04-04)

Karpathy's pattern describes building persistent, compounding knowledge bases where the
LLM acts as a **compiler** — not a retriever. Instead of re-deriving knowledge from raw
documents on every query (traditional RAG), the LLM incrementally builds and maintains a
structured, interlinked wiki that gets richer with each source and question.

This is **exactly** what the Coop knowledge sandbox builds — but with a graph database
instead of markdown files, in a browser instead of a filesystem, and for groups instead
of individuals.

### 14.1 Architecture Mapping

| Karpathy Layer | Coop Equivalent | How It Maps |
|---------------|----------------|-------------|
| **Raw sources** (immutable articles, papers, data) | **Source registry** (allowlisted YouTube, GitHub, RSS, Reddit, NPM) | Curated, immutable inputs. Karpathy drops files in `raw/`. Coop's adapters fetch from allowlisted URLs. |
| **The wiki** (LLM-generated markdown with summaries, entity pages, cross-references) | **Knowledge graph** (Kuzu-WASM with POLE+O entities, temporal edges, cross-references) | The persistent, compounding artifact. Karpathy uses interlinked markdown. Coop uses a graph database with typed entities and relationships. |
| **The schema** (CLAUDE.md defining structure, conventions, workflows) | **Skill manifests + POLE+O model + source registry config** | The meta-layer that tells the LLM how to structure knowledge. Karpathy uses a config doc. Coop uses typed schemas and skill prompts. |

### 14.2 Operation Mapping

| Karpathy Operation | Coop Equivalent | Key Insight |
|-------------------|----------------|-------------|
| **Ingest** — Drop source, LLM reads, writes summary, updates index, revises entity pages, appends log | **Source adapter → entity extraction skill → graph upsert** | Same flow. Karpathy's "updates index, revises entity pages" = our entity extraction updating the graph. The graph IS the index — entities are pages, edges are cross-references. |
| **Query** — Search relevant pages, synthesize answer with citations, file good answers back into wiki | **Graph retrieval → skill context assembly → skill output → reasoning trace** | The critical "file back" step is our reasoning trace system. Good skill outputs become precedent nodes that enrich future queries. The wiki compounds. |
| **Lint** — Health-check: contradictions, stale claims, orphan pages, missing cross-references, data gaps | **NOT EXPLICITLY IN OUR PLAN** — this is a gap we should adopt | We have temporal validity (edges expire) and stale source detection, but no active lint operation. See adoption below. |

### 14.3 The Key Insight: Compilation, Not Retrieval

Karpathy's central thesis: "Rather than re-derive knowledge on every query, build a
persistent, compounding artifact."

This validates our entire approach. Traditional RAG (vector search → chunk retrieval →
LLM synthesis) is what most agent frameworks do. It's stateless — the system learns
nothing between queries. Karpathy rejects this for a **compilation** model where each
interaction enriches the knowledge base.

Coop's knowledge graph IS the compiled artifact:
- **RAG approach** (what we're NOT doing): Agent receives observation → vector-search
  flat memories → synthesize answer from fragments → answer evaporates
- **Compilation approach** (what we ARE doing): Agent receives observation → extract
  entities from sources → upsert into graph with relationships → retrieve via graph
  traversal → synthesize with rich context → record reasoning trace as precedent →
  graph gets richer

The graph never re-derives. It compounds. Each entity extraction adds nodes and edges.
Each reasoning trace adds decision precedent. Each source refresh updates temporal
validity. The more the agent runs, the better its context becomes.

### 14.4 Patterns to Adopt

**1. Lint Operation (NEW — add to plan)**

Karpathy runs periodic health-checks on the wiki. We should add a `knowledge-lint`
skill that runs as a low-priority observation trigger:

```
Lint checks for knowledge graph:
  - Orphan entities: nodes with zero edges (extracted but never connected)
  - Stale sources: sources not refreshed in > 14 days
  - Contradictions: entities with conflicting temporal edges
  - Missing cross-references: entities from same source that should be connected
  - Coverage gaps: source types with zero entities (e.g., all YouTube, no RSS)
  - Graph health: size vs budget, entity count vs relationship ratio
```

This maps to a new observation trigger `knowledge-lint-due` on a weekly cadence.
The lint output surfaces in Roost > Agent > Knowledge section.

**2. Log as Append-Only Audit Trail**

Karpathy's `log.md` is an append-only chronological record of every ingest, query,
and lint pass. We have reasoning traces but no simple chronological log view.

Add: a `graphLog` Dexie table or graph node type that records every operation:
```
[2026-04-06] ingest | Bankless #412 → 12 entities, 8 relationships
[2026-04-06] ingest | filecoin-project/specs → 89 entities, 34 relationships
[2026-04-06] query  | "grant opportunities" → 3 results, used in draft
[2026-04-06] lint   | 2 orphan entities, 1 stale source, 0 contradictions
```

This gives members a simple "what did the agent learn today?" view — not the
full reasoning trace, just the activity log. Surfaces in Roost > Agent as a
lightweight timeline.

**3. "Good Answers Filed Back Into the Wiki"**

Karpathy: "Outputs from queries get filed back into the wiki, so every
exploration adds up."

This is our precedent system — but we can make it more explicit. When a member
approves a draft that the agent created using graph context, that approval
should:
1. Record a positive reasoning trace (already planned)
2. **Strengthen the edges** between the source entities that informed it
   (edge confidence increases)
3. **Create a "validated insight" entity** — the approved draft summary
   becomes a first-class node in the graph, linked to its source entities

Conversely, rejection should:
1. Record a negative reasoning trace (already planned)
2. Decrease edge confidence for the source entities involved
3. NOT delete anything — temporal invalidation, not destruction

This creates Karpathy's compound loop: sources → graph → recommendation →
human judgment → graph enrichment → better future recommendations.

**4. Schema as First-Class Configuration**

Karpathy treats the schema (CLAUDE.md) as a first-class document that
defines how the wiki is structured. We should formalize our equivalent:

The **knowledge schema** for a coop would be:
- POLE+O entity type configuration (which types to extract, weighted by domain)
- Source type priorities (which source types to favor for entity extraction)
- Topic focus areas (what domains the coop cares about)
- Confidence thresholds (minimum confidence for graph inclusion)

This could be a per-coop configurable schema stored in Yjs alongside the
source registry. A regenerative agriculture coop configures ecological entity
types. A DeFi coop configures protocol and token entity types.

### 14.5 What Coop Adds Beyond Karpathy's Pattern

| Dimension | Karpathy (Individual) | Coop (Group) |
|-----------|----------------------|-------------|
| Users | Single person | Multiple members + agent |
| Storage | Local markdown files (git) | Browser IndexedDB (Dexie + Kuzu-WASM) |
| Sync | Git push/pull | Yjs CRDT (real-time, offline-capable) |
| Structure | Flat markdown pages | Typed graph with POLE+O entities + temporal edges |
| Cross-references | Markdown [[links]] | Graph edges with typed relationships |
| Search | BM25 + optional vector (qmd) | Hybrid: BM25 + vector + graph traversal |
| Curation | Manual file drops | Allowlisted source registry with adapters |
| Verification | Manual reading | Human review (Chickens) + Safe multisig |
| Provenance | File names + frontmatter | Graph edges with source refs + temporal validity |
| Execution | Read-only knowledge | Onchain actions via Safe (spending, publishing) |
| Agent | Stateless compiler (runs on demand) | Persistent observer (runs on triggers, builds memory) |

The fundamental upgrade: Karpathy's wiki is for **one person's knowledge**. Coop's
knowledge graph is for **a group's shared understanding** — with review, governance,
and onchain execution built in.

### 14.6 Community Patterns Worth Noting

| Pattern | Source | Coop Relevance |
|---------|--------|---------------|
| **Provenance tracking with content hashes** (Palinode) | Content hashes on every entity, tracking how knowledge was compiled | We have `contentHash` on memories already. Extend to graph entities. |
| **Five-pass compilation pipeline** (sage-wiki) | Typed entity system with self-learning corrections | Our entity extraction could benefit from multi-pass refinement. |
| **Decision records as first-class pages** (Context-as-Code) | Explaining WHY the wiki is structured this way | Our reasoning traces serve this purpose — decisions are first-class. |
| **Ontology-based graph** (blex2011) | Graph database built on formal ontology | Validates our POLE+O graph model. Domain-specific ontologies per coop. |
| **Drift detection** (Zorro) | Auditing structural alignment across systems | Maps to our lint operation — detecting graph health drift. |

---

## 15. Graph ↔ Yjs ↔ CRDT: How They Connect

### 15.1 The Architecture Question

Coop has two data layers that need to work together:

- **Yjs (CRDT)** — Shared state that syncs between members in real-time.
  Artifacts, members, source registries, agent messages. Conflict-free.
- **Kuzu-WASM (Graph)** — Local intelligence that the agent builds from
  sources. Entities, relationships, embeddings, reasoning traces.

The question: what syncs and what stays local?

### 15.2 The Hybrid Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED (Yjs CRDT)                            │
│                                                                 │
│  Syncs between all coop members in real-time                    │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  knowledge-sources-v1    Y.Map    Source registry (what to read) │
│  coop-artifacts-v2       Y.Map    Published artifacts            │
│  coop-members-v2         Y.Map    Member roster                  │
│  knowledge-decisions-v1  Y.Map    Reasoning traces (decisions)   │
│  knowledge-log-v1        Y.Array  Activity log (append-only)     │
│  knowledge-schema-v1     Y.Map    Per-coop POLE+O config         │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    shared identifiers
                    (sourceId, artifactId,
                     traceId, entityName)
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    LOCAL (Kuzu-WASM Graph)                       │
│                                                                 │
│  Built independently on each device from shared sources          │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  Entity nodes          POLE+O typed         Person, Org, etc.   │
│  Relationship edges    Temporal (t_valid)    founded, mentioned  │
│  Embeddings            Vector indexes        Per-entity vectors  │
│  Retrieval indexes     BM25 + vector         Hybrid search       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 15.3 What Syncs vs What Stays Local

| Data | Layer | Why |
|------|-------|-----|
| **Source registry** | Yjs (shared) | All members must see the same allowlisted sources. Adding a YouTube channel is a group decision. |
| **Activity log** | Yjs (shared) | All members should see "agent ingested Bankless #412 → 12 entities." Lightweight, append-only — perfect for Y.Array. |
| **Reasoning traces** | Yjs (shared) | Decision history is institutional memory. When member A approves a draft, member B should see that precedent. Traces are small (IDs + summary + outcome). |
| **Knowledge schema** | Yjs (shared) | Per-coop POLE+O config, topic focus, confidence thresholds. Group-level configuration. |
| **Published artifacts** | Yjs (shared) | Already syncs (existing architecture). |
| **Entity nodes** | Kuzu-WASM (local) | Full entity content + embeddings are large (could be MBs). Each member's agent extracts from the same sources but may produce slightly different extraction results. Local is fine — the inputs (sources) and outputs (decisions) sync; the middle layer (graph) is local intelligence. |
| **Relationship edges** | Kuzu-WASM (local) | Same reasoning — edges are derived from local extraction. |
| **Embeddings** | Kuzu-WASM (local) | Vectors are device-specific (different Transformers.js versions may produce slightly different embeddings). Local generation + local search. |
| **Retrieval indexes** | Kuzu-WASM (local) | Indexes are query infrastructure, not shared state. |

### 15.4 Why This Split Works

The insight: **sync the decisions, not the derivations.**

Every member's agent reads from the same sources (Yjs-synced registry) and
produces the same published artifacts (Yjs-synced). The middle layer — entity
extraction, graph construction, retrieval — is local computation that each
agent performs independently. This is fine because:

1. **Same inputs → similar outputs.** If both agents read the same Bankless
   transcript, they'll extract similar entities. Minor differences in
   extraction don't matter because the decisions (approve/reject) sync.

2. **Decisions are the contract.** When member A's agent recommends a draft
   and member A approves it, the reasoning trace syncs via Yjs. Member B's
   agent sees that precedent and adjusts its own confidence — even if its
   local graph has slightly different entity content.

3. **Graph sync would be prohibitively complex.** Graph databases don't have
   native CRDT semantics. Syncing entity nodes + edges + temporal validity
   across multiple Kuzu-WASM instances would require a custom CRDT layer.
   The engineering cost far exceeds the benefit.

4. **Local graphs can diverge safely.** If member A's agent extracts 47
   entities from a source and member B's extracts 45, both agents still
   function correctly. The divergence is in intermediate computation, not
   in shared outcomes.

### 15.5 The Connection Points

Where local graph meets shared Yjs:

```
SOURCE REGISTRY (Yjs)
  │
  │ Agent reads allowlisted sources
  ▼
ENTITY EXTRACTION (Local)
  │
  │ Agent builds graph from source content
  ▼
GRAPH (Kuzu-WASM, Local)
  │
  │ Agent queries graph for relevant context
  ▼
SKILL OUTPUT (Local)
  │
  │ Agent produces draft recommendation
  ▼
REASONING TRACE (Yjs)  ◄── syncs decision + source refs
  │
  │ Member reviews in Chickens
  ▼
ARTIFACT (Yjs)  ◄── syncs published content
  │
  │ Approval/rejection flows back
  ▼
GRAPH ENRICHMENT (Local)  ◄── edge confidence adjusted
  │                             from synced trace outcome
  ▼
ACTIVITY LOG (Yjs)  ◄── syncs "approved draft, 3 source entities strengthened"
```

The key identifiers that bridge local and shared:
- `sourceId` — links graph entities to Yjs-synced source registry entries
- `artifactId` — links graph insights to Yjs-synced published artifacts
- `traceId` — links graph reasoning to Yjs-synced decision history
- `entityName` + `entityType` — referenced in traces, human-readable in UI

### 15.6 Yjs Data Structures for Knowledge Sandbox

New Y.Map/Y.Array entries in the Yjs doc (extending `sharedKeys` in sync-core/doc.ts):

```typescript
// Source registry — who added which sources, active state
'knowledge-sources-v1': Y.Map<string, KnowledgeSourceEntry>
// Each entry: { type, identifier, label, addedBy, addedAt, active }
// Key: sourceId

// Reasoning traces — shared decision history
'knowledge-decisions-v1': Y.Map<string, ReasoningTraceEntry>
// Each entry: { traceId, skillRunId, observationTrigger, confidence,
//   outputSummary, outcome, sourceEntityNames[], precedentTraceIds[] }
// Key: traceId

// Activity log — append-only chronological record
'knowledge-log-v1': Y.Array<KnowledgeLogEntry>
// Each entry: { type: 'ingest'|'query'|'lint'|'approval'|'rejection',
//   timestamp, summary, sourceId?, entityCount?, traceId? }

// Per-coop knowledge schema — configurable extraction
'knowledge-schema-v1': Y.Map<string, unknown>
// { poleTypePriorities: [...], topicFocus: [...], confidenceThreshold: 0.4 }
```

These follow the existing V2 pattern (field-level CRDT merge via nested Y.Maps)
established by `coop-artifacts-v2` and `coop-members-v2`.

### 15.7 CRDT Properties We Get For Free

| Property | How Yjs Handles It | Knowledge Sandbox Benefit |
|----------|-------------------|-------------------------|
| **Conflict-free merging** | Last-writer-wins per Y.Map field | Two members add sources simultaneously → both appear |
| **Offline support** | Yjs buffers updates in y-indexeddb | Member adds source offline → syncs when reconnected |
| **Peer-to-peer sync** | y-webrtc (direct) + y-websocket (relay) | Source changes propagate without server roundtrip |
| **Append-only safety** | Y.Array preserves insertion order | Activity log entries never lost, even with concurrent appends |
| **Partial sync** | Yjs sends incremental updates, not full state | Adding one source doesn't resend all 50 sources |
| **History** | Yjs tracks full operation history | Can replay how the source registry evolved |

### 15.8 What This Means for Wikipedia as a Source

Wikipedia is special — it's an **enrichment source**, not a primary capture source:

```
Primary source (YouTube transcript)
  → Entity extraction: "Filecoin" entity identified
  → Wikipedia enrichment: fetch en.wikipedia.org/wiki/Filecoin
  → Graph enrichment: add description, founding date, category edges
  → Result: richer entity node with cross-source context
```

Wikipedia adapter uses the [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page):
- `action=query&prop=extracts` for article text
- `action=query&prop=categories` for category taxonomy
- `action=parse&prop=wikitext` for structured infobox data
- Rate limit: respectful polling, cache aggressively (Wikipedia content changes slowly)

Allowlist unit: article title or Wikidata QID. Members can allowlist specific
articles ("Filecoin", "Regenerative agriculture") or use Wikidata QIDs for
language-independent references.

Wikipedia enrichment happens at **ingestion time** (eager), not retrieval time:
when the entity extractor identifies a named entity, a background job checks
if a corresponding Wikipedia article exists in the allowlist and enriches the
graph node with Wikipedia content. This keeps retrieval fast (no network calls).

---

## 16. Connection to Existing Plans

| Existing Plan | Relationship |
|---------------|-------------|
| **Agent Evolution** (`.plans/features/agent-evolution/`) | Knowledge sandbox is the foundation for Workstream 1 (runtime skills) — skills consume graph context |
| **Agent Autonomy Roadmap** | Phase 3 (Agent Intelligence) calls for "semantic memory retrieval with embeddings" — graph memory delivers this |
| **Knowledge Sharing & Scaling** | The 6-stage pipeline (capture → archive) gains a new input: source adapters feeding the graph |
| **Next-Gen Model Readiness** | Graph retrieval reduces context window pressure — better retrieval = smaller prompts = faster inference |
| **Filecoin Cold Storage** | Archived graph snapshots could be stored on Filecoin for long-term provenance |

---

## 16. Sources

### Research
- [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — Persistent compounding knowledge base pattern (compilation > retrieval)
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)
- [Graphiti: Knowledge Graph Memory for an Agentic World](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)
- [KuzuDB for Production AI Agents (Vela Partners)](https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database)
- [In-Browser Graph RAG with Kuzu-WASM](https://blog.kuzudb.com/post/kuzu-wasm-rag/)
- [State of AI Agent Memory 2026 (Mem0)](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [Neo4j Context Graph Meetup Talk](https://youtu.be/qMV64p-4Deo) — Will (Neo4j AI Innovation PM)
- [Neo4j Agent Memory package](https://github.com/neo4j-labs/agent-memory) — POLE+O model, 3-tier extraction, reasoning traces
- [Context Graph Demo](https://context-graph-demo.vercel.app/) — Financial services context graph agent (open source)
- [Foundation Capital: Context Graphs](https://foundationcapital.com/) — "Trillion dollar opportunity" thesis

### Tools & Libraries
- [Kuzu-WASM npm](https://www.npmjs.com/package/@kuzu/kuzu-wasm)
- [Kuzu-WASM GitHub](https://github.com/unswdb/kuzu-wasm)
- [LevelGraph](https://github.com/levelgraph/levelgraph)
- [feed-mcp (RSS→MCP)](https://medium.com/@richardwooding/supercharging-ai-agents-with-rss-atom-json-feeds-a-developers-guide-to-feed-mcp-7da545669f96)
- [TranscriptAPI](https://transcriptapi.com/)
- [GitExtract](https://gitextract.com)

### Architecture References
- [OpenClaw Architecture Lessons](https://blog.agentailor.com/posts/openclaw-architecture-lessons-for-agent-builders)
- [OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)
- [NVIDIA Sandboxing Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/)
- [Microsoft Agent Governance Toolkit](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/)
- [Mozilla wasm-agents](https://blog.mozilla.ai/wasm-agents-ai-agents-running-in-your-browser/)
