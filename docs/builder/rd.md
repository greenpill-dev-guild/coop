---
title: R&D
slug: /builder/rd
---

# R&D

This page summarizes the active research and technical risk lanes rather than reproducing the entire
long-form audits.

## Highest-Priority Architecture Risks

The current reference docs repeatedly point to the same core issues:

- CRDT correctness where shared arrays are still written too coarsely
- remotely hosted WASM that weakens offline and extension-distribution guarantees
- fixed-interval polling that burns battery and CPU
- missing evaluation harnesses for the agent
- weak eventing between contexts compared with a typed bus model

## Near-Term Research Lanes

- make the sync model more correct before adding more autonomy
- improve model loading, capability detection, and fallback behavior
- ~~extract monolithic runtime files into clearer handlers and interfaces~~ — largely resolved:
  background.ts uses handler decomposition (12 handler modules), SidepanelApp.tsx is 174 lines with
  orchestration extracted to hooks, PopupApp.tsx is a thin shell with a screen router, and
  operator-sections.tsx has been split into 11 files
- improve storage quota awareness and blob lifecycle handling

## Longer-Horizon Work

- event-driven scheduling instead of constant polling
- compositional prompts and lazy skill loading
- portability toward other shells
- richer tool and interop layers around the agent model

## Best Source Docs

- [Reference: Agent OS Roadmap](/reference/agent-os-roadmap)
- [Reference: Knowledge Sharing And Scaling](/reference/knowledge-sharing-and-scaling)
- [Reference: UI Review Issues](/reference/ui-review-issues)
