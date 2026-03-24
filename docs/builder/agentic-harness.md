---
title: Agentic Harness
slug: /builder/agentic-harness
---

# Agentic Harness

Coop runs a browser-native observe → plan → act loop inside the extension. The harness is designed
to be useful before it is fully autonomous.

## Core Loop

Each cycle does six things:

1. observe local state for actionable triggers
2. deduplicate observations by fingerprint
3. plan skill execution through a dependency graph
4. execute skills through the inference cascade
5. emit drafts or action proposals
6. log trace data for review and debugging

## Skill System

The harness currently has 16 registered skills. Skills are defined via `SKILL.md` files loaded at
build time through `import.meta.glob` from `skills/*/SKILL.md`, allowing skill definitions to be
maintained as markdown with YAML frontmatter (name, description, triggers, dependencies, approval
mode).

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
graph LR
    subgraph Core["Core Intelligence"]
        OE[opportunity-extractor]
        MIS[memory-insight-synthesizer]
        TC[theme-clusterer]
        RD[review-digest]
        TR[tab-router]
    end

    subgraph Grants["Grants & Economics"]
        GFS[grant-fit-scorer]
        CFB[capital-formation-brief]
        EEE[ecosystem-entity-extractor]
    end

    subgraph GreenGoods["Green Goods"]
        GGA[green-goods-assessment]
        GGB[green-goods-garden-bootstrap]
        GGS[green-goods-garden-sync]
        GGAS[green-goods-gap-admin-sync]
        GGW[green-goods-work-approval]
    end

    subgraph OnChain["On-Chain"]
        ER[erc8004-register]
        EF[erc8004-feedback]
        PRC[publish-readiness-check]
    end

    TR --> OE
    OE --> TC
    TC --> RD
    OE --> GFS
    OE --> GGA
```

Each skill declares:

- triggers
- dependencies
- output schema references
- approval modes
- timeout and skip conditions

The planner topologically sorts them with deterministic ordering so that skill execution stays
predictable.

## Inference Cascade

The current cascade is:

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
flowchart TD
    Start["Skill needs inference"] --> Check{"WebGPU\navailable?"}
    Check -->|Yes| WebLLM["WebLLM\nHighest capability\nLocal GPU inference"]
    Check -->|No| WASM{"WASM\navailable?"}
    WASM -->|Yes| TJS["transformers.js\nCPU-based\nSmaller models"]
    WASM -->|No| Heuristic["Heuristic Rules\nDeterministic\nNo model needed"]
    WebLLM --> Output["Skill output"]
    TJS --> Output
    Heuristic --> Output
```

- WebLLM on WebGPU when available
- transformers.js on WASM as the next fallback
- heuristic rules when models are unavailable or deterministic behavior is preferable

The design goal is graceful degradation, not maximum model ambition at any cost.

## Approval Model

The harness supports three approval tiers:

- `advisory`
- `proposal`
- `auto-run-eligible`

Even the last tier is still bounded by user opt-in and policy.

## Observability

Structured logs are written to Dexie with correlated traces and spans. This matters because browser
agents are otherwise difficult to debug, especially when failures happen in background contexts.

## Current Gaps

The reference roadmap still calls out several active limitations:

- ~~no systematic evaluation harness~~ — resolved: `agent-eval.ts` provides a per-skill evaluation
  harness with fixture-based test cases loaded via `import.meta.glob` from `skills/*/eval/*.json`,
  covering all 16 skills
- fixed-interval polling instead of a fuller event-driven model
- ~~large runtime files that need more modularity~~ — largely resolved: `operator-sections.tsx`
  split into 11 focused section components, `background.ts` uses handler decomposition across
  dedicated handler modules, and popup/sidepanel extracted into thin shells with orchestration hooks
- broader portability work still ahead

Read [R&D](/builder/rd) for the current evolution lanes.
