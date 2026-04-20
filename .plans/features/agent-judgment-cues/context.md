# Context

- Existing review surfaces already lived in the extension:
  - Roost agent summary and pending-plan card
  - Nest operator console helper plans and waiting chores
- Existing harness boundaries were already good:
  - skills produce typed action proposals
  - plans require approval before queueing actions
  - queued actions flow through policy and execution handlers
- Missing behavior before this pack:
  - no shared risk vocabulary
  - no deterministic way to tell low-risk approvals from high-stakes ones
  - no inline acknowledgement for live, permission, or destructive actions

## Relevant Areas

- `packages/shared/src/contracts/schema-agent.ts`
- `packages/shared/src/contracts/schema-policy.ts`
- `packages/shared/src/modules/agent/agent.ts`
- `packages/shared/src/modules/policy/`
- `packages/extension/src/runtime/agent/output-handlers-*`
- `packages/extension/src/background/handlers/actions.ts`
- `packages/extension/src/views/Sidepanel/`
