---
title: "Claude Code vs Coop Agent Harness"
slug: /reference/claude-code-vs-coop-harness
---

# Claude Code vs Coop Agent Harness — Architecture Comparison

> Analysis date: 2026-03-31. Based on Claude Code OSS (github.com/anthropics/claude-code) and Coop agent harness in `packages/shared/src/modules/agent/` + `packages/extension/src/runtime/`.

## 1. Agent Loop

| | **Claude Code** | **Coop** |
|---|---|---|
| **Runtime** | Cloud LLM (Claude API) with streaming tool use | Local-first: Heuristic -> ONNX Transformers -> WebGPU/WebLLM |
| **Loop** | User prompt -> LLM reasons -> emits tool_use -> executor runs tool -> result fed back -> LLM continues until done | Observation (event) -> prioritize -> select skills -> build prompt -> local inference -> apply output |
| **Trigger** | User-initiated (typed prompt) | Event-driven (draft saved, capture completed, tab batch ready, scheduled conditions) |
| **Concurrency** | Sequential within one agent, parallel via subagent spawning | Batch up to 8 observations per cycle, sequential skill execution within each |
| **Stuck recovery** | Context compaction when window fills; user can `/clear` | 5-minute stuck-state timeout, quality-based stalling (confidence < 0.3), 3-failure pause |

**Key insight**: Claude Code is *reactive to humans*, Coop is *reactive to data*. Claude Code waits for you to ask; Coop's agent runs autonomously when observations fire. Coop is closer to a background daemon.

## 2. Tool / Skill System

| | **Claude Code** | **Coop** |
|---|---|---|
| **Definition** | JSON Schema per tool (name, description, parameters) + TypeScript handler | Declarative `skill.json` manifest + `SKILL.md` instruction file |
| **Registry** | Built-in tools (Read, Edit, Bash, Grep, Glob, Write) + MCP dynamic tools + deferred lazy-loading | `import.meta.glob()` at build time, validated on load |
| **Dispatch** | LLM selects tools by name from schema list; executor pattern-matches | `selectSkillIdsForObservation()` filters by trigger type, topological sort on `depends/provides` |
| **Schema** | Standard JSON Schema with `required`, types, descriptions | Custom manifest: `triggers`, `inputSchemaRef`, `outputSchemaRef`, `allowedTools`, `model` preference |
| **Count** | ~15 built-in + unlimited MCP | 17 domain-specific skills |

### Patterns to adopt from Claude Code

- **Deferred tool loading** — Claude Code lazy-loads tool schemas via `ToolSearch` to keep the initial context small. Coop loads all 17 skill manifests at build time. For scale, consider lazy-loading skill instructions.
- **MCP as extensibility protocol** — Claude Code's MCP integration lets *anyone* add tools without modifying core. Coop skills are baked in. An MCP-like plugin protocol would let coop members bring their own skills.

## 3. Permission Model

| | **Claude Code** | **Coop** |
|---|---|---|
| **Modes** | `plan` (approval required), `auto` (bypass), `default` (prompt per tool) | `advisory` (drafts only), `auto` (low-risk), `restricted` (explicit approval) |
| **Granularity** | Per-tool: user approves/denies each tool call | Per-skill: `allowedActionClasses` + `requiredCapabilities` checked at manifest level |
| **Dangerous ops** | Hardcoded guards (no force push, no `--no-verify`, confirmation for destructive actions) | `ActionProposal` queue — advisory mode queues for dashboard approval, auto mode executes |
| **User feedback** | Denial prevents retry of same call; agent adjusts approach | Approval/rejection stored as `user-feedback` memory, feeds into next cycle |

**Coop is ahead here**: The approval -> memory feedback loop is more sophisticated. Claude Code treats denials as one-off signals. Coop persists them as typed memories that influence future decisions.

**Pattern to adopt from Claude Code**: The tiered permission escalation (auto -> default -> plan) is cleaner UX than a binary advisory/auto. A middle "ask once per session" mode would reduce approval fatigue.

## 4. Memory & Context Management

| | **Claude Code** | **Coop** |
|---|---|---|
| **Persistence** | `CLAUDE.md` (project instructions) + `~/.claude/projects/*/memory/` (file-based memories with YAML frontmatter) | Dexie (IndexedDB) with typed memory records (`skill-pattern`, `observation-outcome`, `decision-context`, `user-feedback`) |
| **Retrieval** | All of `CLAUDE.md` loaded every conversation; memories loaded by relevance via `MEMORY.md` index | `queryMemoriesForSkill()` — priority-ranked: member > coop patterns > outcomes > context > general; 8 per skill |
| **Compaction** | Automatic context compression when approaching window limits; `PreCompact` hook saves state | Per-field word limits (title: 20-24, summary: 32-40), stale filtering (30-day decay), hard cap 500/coop |
| **Memory types** | `user`, `feedback`, `project`, `reference` (human-oriented) | `skill-pattern`, `observation-outcome`, `decision-context`, `user-feedback`, `general` (agent-oriented) |
| **Lifecycle** | Manual save/update/delete; staleness warnings in system prompt | Auto-pruning (TTL expiry), deduplication by content hash, LRU eviction at cap |

**Key difference**: Claude Code's memory is *for the human-agent collaboration* (remember my preferences, project context). Coop's memory is *for the autonomous agent* (remember what worked, what patterns fit). Both valid for their modality.

**Pattern to adopt from Claude Code**: The `MEMORY.md` index file is clever — a human-readable, git-tracked table of contents for memories. Coop's memories are buried in IndexedDB. A readable export/summary of agent memories would help operators understand what the agent has learned.

## 5. Hooks & Automation

| | **Claude Code** | **Coop** |
|---|---|---|
| **System** | Shell commands triggered by events (pre/post tool use, session start, compaction) | Observation triggers (data events -> fingerprinted observations -> cycle request) |
| **Configuration** | `settings.json` hooks array with match patterns | Declarative in skill manifests (`triggers` field) + condition functions |
| **Scope** | User-level automation (format on save, lint before commit, custom validation) | Agent-level automation (emit observation when draft confidence > 0.24, when 7 days since review) |

**Pattern to adopt**: Claude Code's hooks are *user-extensible* — anyone can add a shell command hook without touching source. Coop's triggers are hardcoded. Adding a user-configurable trigger system (even just "run skill X when condition Y") would be powerful.

## 6. Subagent / Concurrency

| | **Claude Code** | **Coop** |
|---|---|---|
| **Model** | Spawn autonomous subagents with full tool access; typed agents (oracle, cracked-coder, code-reviewer, etc.) | Single agent loop processing batched observations; no subagent spawning |
| **Isolation** | Git worktree isolation for parallel file edits | N/A — single execution context |
| **Communication** | `SendMessage` between agents; `TaskCreate/Update` for progress tracking | Observations + Dexie for state passing between cycles |
| **Parallelism** | True parallel execution across multiple LLM sessions | Sequential within cycle, but cycles can be queued |

**Pattern to adopt**: Subagent specialization. Coop could benefit from running independent skills (opportunity-extractor and tab-router) as parallel "micro-agents" within a single cycle. The topological sort already handles dependencies; skills without mutual deps could run concurrently.

## 7. What Coop Does That Claude Code Doesn't

1. **Local-first inference cascade** — The heuristic -> ONNX -> WebGPU fallback chain is unique. Claude Code is 100% cloud-dependent. Major differentiator for privacy and offline capability.

2. **Quality-based self-regulation** — Tracking confidence trends and stalling when quality degrades. Claude Code has no equivalent — if the LLM gives bad output, it just keeps going.

3. **Fingerprint-based idempotency** — Content-hashing observations to prevent duplicate work. Production-grade infrastructure that Claude Code doesn't need (human-triggered, not event-driven).

4. **JSON repair for small models** — The `repairJson()` pipeline (control char stripping, trailing comma removal, stack-based brace closure) is essential for 0.5B parameter models. Claude Code never needs this.

5. **Scoped memory with priority ranking** — Member > coop > pattern type hierarchy with stale decay is more nuanced than Claude Code's flat memory system.

6. **Domain-specific skill pipeline** — 17 skills purpose-built for opportunity extraction, grant scoring, ecosystem analysis. Claude Code's tools are generic (read file, edit file, run command).

## 8. Actionable Adoption Roadmap

| Priority | Pattern | What it is | How it could work in Coop |
|----------|---------|-----------|--------------------------|
| **P0** | MCP tool protocol | Standard protocol for external tool integration | Let coop members register custom skills via MCP-like manifest without modifying extension source |
| **P0** | Deferred skill loading | Lazy-load tool schemas to save context | Lazy-load `SKILL.md` instructions only when a skill is selected for execution |
| **P1** | User-extensible hooks | Shell/JS hooks triggered by named events | `coop.hooks.json` — user-defined actions on observation triggers (e.g., "on high-confidence-draft, notify Slack") |
| **P1** | Typed agent specialization | Purpose-built agents (oracle, reviewer, coder) | Define skill "profiles" — groups of skills that run together for specific workflows (review profile, capture profile, publish profile) |
| **P2** | Conversation compaction | Automatic summarization when context fills | Compress observation history into summary memories when approaching Dexie storage limits |
| **P2** | Plan mode preview | Show what will happen before executing | Preview mode for action proposals — show the full plan with diffs before executing any auto-approved actions |
| **P2** | Memory export | Human-readable memory index | Operator-facing summary of what the agent has learned, exportable from IndexedDB |

## 9. Summary

**Claude Code** is a *human-in-the-loop tool augmentation layer* — powerful cloud LLM + generic tools + rich permission model. Excels at flexibility and extensibility.

**Coop** is an *autonomous background agent with domain expertise* — local inference + specialized skills + event-driven activation. Excels at privacy, offline capability, and self-regulation.

They solve fundamentally different problems: Claude Code amplifies a developer's hands; Coop gives a group a tireless background analyst. The biggest opportunities are borrowing Claude Code's extensibility patterns (MCP, hooks, lazy loading) while keeping Coop's unique strengths in local-first inference and autonomous quality control.
