# Coop Development Masterplan

Date: 2026-03-05  
Scope Source: `260305 Luiz X Afo Coffee.md`, `.cursor/plans/coop_monorepo_development_516cb53b.plan.md`, `docs/coop-component-plans.md`

## Project Scope

Coop is a browser-first knowledge commons for local and bioregional coordination. The MVP scope is:

- Chromium extension as the primary interface
- Voice-first PWA companion
- Anchor node for strong AI inference and coordination logic
- Three-layer storage: local node, shared membrane, cold storage
- On-chain Coop registry with smart account patterns
- Four pillars: impact reporting, coordination, governance, capital formation

## Current State

- Monorepo scaffold exists and is restored.
- Component implementation plan exists but is still mostly pending.
- The next work phase is full implementation of component plans and cross-cutting validation.

## Architecture

```mermaid
graph TB
  subgraph browserLayer [Browser Layer]
    extensionUi["Chromium Extension"]
    pwaUi["Voice-First PWA"]
    localStorage["IndexedDB Local Storage"]
  end

  subgraph membraneLayer [Shared Membrane]
    p2pTransport["WebRTC or WS Membrane"]
    consensusFlow["Content Approval Flow"]
  end

  subgraph anchorLayer [Anchor Node]
    anchorApi["Fastify REST/WS API"]
    agentRuntime["Skill Runtime"]
    strongInference["Strong AI Inference"]
  end

  subgraph persistenceLayer [Cold Persistence]
    storachaLayer["Storacha Filecoin Layer"]
    optionalGitBackup["Optional Git Backup"]
  end

  subgraph chainLayer [On-Chain]
    coopRegistry["CoopRegistry Contract"]
    smartAccounts["ERC-4337 Smart Accounts"]
  end

  extensionUi --> localStorage
  pwaUi --> localStorage
  localStorage --> p2pTransport
  p2pTransport --> consensusFlow
  consensusFlow --> anchorApi
  anchorApi --> agentRuntime
  agentRuntime --> strongInference
  anchorApi --> storachaLayer
  anchorApi --> coopRegistry
  smartAccounts --> coopRegistry
```

## Plan Index

| # | Component | Plan File | Status | Priority |
|---|-----------|-----------|--------|----------|
| 0 | Monorepo Scaffold | `00-scaffold-complete.md` | DONE | N/A |
| 1 | Browser Extension | `01-extension.md` | TODO | P0 |
| 2 | Anchor Node | `02-anchor-node.md` | TODO | P0 |
| 3 | PWA Companion | `03-pwa.md` | TODO | P1 |
| 4 | Shared Package | `04-shared-package.md` | TODO | P0 |
| 5 | Smart Contracts | `05-contracts.md` | TODO | P1 |
| 6 | Org-OS Integration | `06-org-os-integration.md` | TODO | P2 |
| 7 | Skills System | `07-skills-system.md` | TODO | P1 |
| 8 | Cross-Cutting | `08-cross-cutting.md` | TODO | P0 |

## Recommended Execution Order

1. `04-shared-package.md`
2. `01-extension.md`
3. `02-anchor-node.md`
4. `08-cross-cutting.md` (initial env/test baseline)
5. `03-pwa.md`
6. `07-skills-system.md`
7. `05-contracts.md`
8. `06-org-os-integration.md`
9. `08-cross-cutting.md` (final validation pass)

## Coordination Rules for Main Agent and Subagents

- Main agent chooses one plan file per execution block.
- Subagents work only within listed key files per plan.
- Any dependency addition must be recorded in the plan file touched.
- Status changes should be logged directly in this masterplan table during execution cycles.
