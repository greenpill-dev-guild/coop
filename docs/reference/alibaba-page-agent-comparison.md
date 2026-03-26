---
title: "Alibaba Page Agent Comparison"
slug: /reference/alibaba-page-agent-comparison
---

# Alibaba Page Agent Comparison

Date: March 21, 2026

This note compares [Alibaba Page Agent](https://github.com/alibaba/page-agent) with Coop and captures the main ideas worth revisiting later.

## Snapshot

As of March 21, 2026:

- `page-agent` npm latest: `1.6.0`
- Latest changelog entry: `1.6.0` dated `2026-03-21`
- Repository positioning: embedded GUI agent for web apps, with optional extension and new MCP bridge

The important framing is that Page Agent is not trying to be a shared memory or coordination system. It is trying to be the easiest way to add an AI operator to an existing web app.

## What Page Agent Is

Page Agent is a browser-native automation library with four main layers:

1. `PageAgentCore`
   Headless agent loop with tool-calling, history, hooks, and execution lifecycle.
2. `PageController`
   DOM extraction plus indexed element actions like click, input, select, and scroll.
3. `PageAgent`
   Turnkey version with an in-page UI panel.
4. Optional extension and MCP bridge
   Adds multi-tab/browser control and lets external agent clients trigger tasks.

Its primary product move is packaging:

- one-line script embed for evaluation
- one npm package for real integration
- simple `execute(task)` API
- optional extension only when current-page limits become a problem

## What Coop Is

Coop is much broader than an embedded GUI agent.

Coop is a browser-first, local-first coordination system that:

- captures tabs, audio, photos, files, and links
- refines them through a local skill pipeline
- stores persistent observations, plans, memories, and drafts
- routes outputs through review and approval
- publishes into shared coop state
- supports governance, archive, onchain, and Green Goods flows

Relevant local references:

- Repo root: `README.md`
- [agent-harness.md](./agent-harness.md)
- [policy-session-permit.md](./policy-session-permit.md)

## Similarities

- Both are browser-native agent systems.
- Both rely on structured tools/actions instead of plain chat.
- Both keep a human in the loop.
- Both can use an extension path when they need browser-level control.
- Both think in modular capability units.

Page Agent does this with custom tools and page instructions.

Coop does this with skill manifests, DAG execution, approval modes, and typed action proposals.

## Differences

### Product Scope

Page Agent:

- embedded AI operator for a web application
- mostly focused on acting on the current page
- optional extension for multi-page tasks

Coop:

- shared memory and coordination substrate
- cross-surface capture and refinement
- review, publishing, provenance, and governance

### Runtime Model

Page Agent:

- expects an OpenAI-compatible model endpoint by default
- text-only DOM representation
- task history is mostly local to a single execution

Coop:

- local-first inference cascade: WebLLM -> transformers.js -> heuristic
- persistent observations, plans, memories, skill runs, and logs
- designed for repeated ongoing workflows, not only one-off page tasks

### Security Model

Page Agent:

- element allow/block lists
- transform hook for data masking
- token-gated extension bridge for privileged extension access

Coop:

- policy engine
- approval queue
- permits and session capabilities
- typed action bundles
- replay protection
- scoped execution and operator review

This is one of Coop's strongest differentiators.

## What Page Agent Gets Very Right

### 1. Packaging and Developer Adoption

This is the clearest thing Coop could learn from.

Page Agent is easy to understand:

- add a script
- instantiate an agent
- call `execute("...")`

That is much easier to adopt than a full coordination product. It lowers the surface area to one immediate value proposition.

### 2. Clean Layering

Their decomposition is strong:

- core runtime
- page controller
- UI wrapper
- extension
- MCP bridge

That is a good product architecture because it lets users enter at different levels of sophistication.

### 3. Site-Specific Adaptation Hooks

Page Agent exposes practical adaptation points:

- `instructions`
- `getPageInstructions(url)`
- `transformPageContent`
- `customTools`
- interactive allow/block lists

These are simple and high leverage.

### 4. Inline Human Interface

Their in-page panel is a smart default.

Coop has stronger operator and governance UX, but Page Agent has a better "instant copilot inside the page" UX.

### 5. MCP as a Distribution Layer

Their MCP server is not the core product. It is an adapter.

That is the right shape. It widens interoperability without distorting the internal architecture.

## What Coop Could Adopt

### 1. A Thin Embed Surface

The strongest adoptable idea is an embeddable Coop surface, for example:

- `@coop/embed`
- `@coop/page-agent`
- `@coop/agent-bridge`

Possible shape:

```ts
const coopAgent = new CoopEmbedAgent({
  mode: 'local-first',
  coopId,
  approvalMode: 'proposal',
})

await coopAgent.execute('Review this grant form and draft a funding lead')
```

The key is not copying Page Agent exactly. The key is giving partner apps an easy entry point into Coop's much richer substrate.

### 2. Headless + UI + Extension Split

Coop would benefit from a cleaner public split between:

- headless runtime
- embedded panel UI
- browser-extension bridge
- external agent bridge

That decomposition would make the system easier to explain, integrate, and eventually publish as modular packages.

### 3. Page-Level Context Hooks

Coop should likely expose first-class page adaptation hooks for embedded contexts:

- per-origin instructions
- per-route instructions
- page masking/transformation before inference
- scoped custom tools for a host app

This is especially useful for grant portals, governance dashboards, and admin tools.

### 4. Safer External Action Bridge

Coop already has a bridge-like pattern in the receiver flow:

- `packages/extension/entrypoints/receiver-bridge.content.ts`
- `packages/app/src/hooks/useReceiverSync.ts`

That suggests a path toward a more general embedded bridge.

But Coop should not copy Page Agent's `localStorage` token model directly.

A better Coop version would use:

- scoped permits
- policy checks
- audit logs
- approval tiers
- capability-limited sessions

That would preserve Coop's strongest design property: governed execution.

### 5. A Lighter "Act In Place" UX

Right now Coop is optimized around capture -> refine -> review -> share.

There is room for a parallel UX:

- "act here in this app"
- "draft from this page"
- "route this page into my coop"
- "prepare action proposal from this workflow"

That would make Coop feel more like an active coordination membrane rather than only a capture/review system.

## Where Coop Still Has the Bigger Opportunity

Page Agent is compelling, but it is fundamentally a UI-action layer.

Coop can be more than that because it already combines:

- local inference
- persistent memory
- shared CRDT state
- review workflows
- typed action proposals
- governance and approvals
- archival provenance
- onchain execution

So the real opportunity is:

**be the governed, memory-backed, local-first version of embedded page automation**

not:

**be a clone of Page Agent**

## Practical Product Direction

If Coop wanted to build the closest useful analogue, the likely wedge is:

### Coop Embed

An embeddable library for trusted partner apps that can:

- understand the current page
- run local or optional remote inference
- expose a small panel
- route findings into Coop observations or drafts
- request governed actions through the policy/permit/session system

That would position Coop as:

- better than Page Agent for durable workflows
- safer than Page Agent for privileged actions
- more valuable than Page Agent for collective memory and coordination

## Suggested Near-Term Experiments

1. Extract a minimal embed-ready runtime boundary from the extension agent stack.
2. Define a tiny public API for `observe()`, `draft()`, and `proposeAction()`.
3. Add page-level instruction hooks for embedded use.
4. Reuse the receiver bridge pattern as a prototype for a general app-to-extension bridge.
5. Prototype an in-page Coop panel for one trusted workflow, likely a grant or intake flow.

## Summary

Page Agent validates a very important idea:

there is real value in making a web page directly operable by an embedded agent with a tiny integration footprint.

Coop should probably adopt that packaging lesson.

But Coop's advantage is not simpler page control. Its advantage is that the page interaction can plug into a governed, local-first, memory-rich coordination system.

That is the path worth preserving.

## Sources

- [Alibaba Page Agent GitHub repository](https://github.com/alibaba/page-agent)
- [Page Agent documentation](https://alibaba.github.io/page-agent/docs/introduction/overview)
- [Page Agent changelog](https://github.com/alibaba/page-agent/blob/main/docs/CHANGELOG.md)
- [Page Agent MCP package](https://github.com/alibaba/page-agent/tree/main/packages/mcp)
