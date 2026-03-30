---
feature: codex-readiness-cleanup
title: Codex readiness hotspot cleanup lane
lane: state
agent: codex
status: backlog
source_branch: chore/codex-readiness-cleanup
work_branch: codex/state/codex-readiness-cleanup
depends_on:
  - ../spec.md
owned_paths:
  - packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts
  - packages/extension/src/views/Sidepanel/tabs/NestTab.tsx
  - packages/shared/src/contracts/schema-agent.ts
  - packages/shared/src/modules/agent/agent.ts
done_when:
  - splitUsePopupOrchestrationState(
  - nestTabStateViewModel
skills:
  - architecture
  - shared
updated: 2026-03-26
---

# State Lane

- Only take work here when it clearly shrinks a current automation-hostile hotspot.
- Current candidates:
  - `packages/extension/src/views/Popup/hooks/usePopupOrchestration.ts`
  - `packages/extension/src/views/Sidepanel/tabs/NestTab.tsx`
  - `packages/shared/src/contracts/schema-agent.ts`
  - `packages/shared/src/modules/agent/agent.ts`
- Low-risk hygiene is also fair game when it has immediate payoff, for example tracked junk cleanup in touched areas.
- Do not reopen already-landed decomposition work from the archived source plan.
