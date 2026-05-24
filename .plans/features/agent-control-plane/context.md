# Context For Agent Control Plane

## Existing References

- `.plans/features/agent-evolution/` owns runtime skill direction, inter-agent communication, and
  scoped spending concepts that should not be duplicated here.
- `.plans/features/session-key-phase-2/` owns session-key scope expansion, lifecycle, permit,
  policy, and delegated authority details.
- `.plans/features/agent-knowledge-sandbox/` owns provenance, reasoning trace, graph/source
  grounding, and local memory-loop precedent.
- `.plans/features/production-readiness/` owns release-gate framing and should receive only
  explicit future blockers once this hub is activated.

## Relevant Codepaths

- `packages/shared/src/modules/agent`
- `packages/shared/src/modules/policy`
- `packages/shared/src/modules/session`
- `packages/shared/src/modules/permit`
- `packages/shared/src/modules/storage`
- `packages/shared/src/modules/sync-core`
- `packages/extension/src/runtime/agent`
- `packages/extension/src/background/handlers`
- `packages/extension/src/views/Nest`
- `packages/extension/src/views/Roost`
- `packages/extension/src/views/shared`

## Constraints

- Browser-first/local-first remains the product constraint. The future control plane should prove
  browser-native durability and recovery before defaulting to a hosted enterprise runtime.
- Passkey/member/Safe/session authority remains the identity constraint. Enterprise OAuth-style
  identity providers are not the default answer for Coop.
- Source bodies and private context stay local unless explicitly published or synced.
- Observability must stay metadata-first and local-only by default; the run ledger should not become
  a hidden channel for source bodies, secrets, private prompts, credentials, or unredacted retrieved
  content.
- Advanced operator controls must not make the default Coop surface feel like an agent-management
  console.
- UI should depend on real state/runtime affordances. If UI work starts before state implementation,
  limit it to fixtures and design exploration, not live stop/revoke controls.
- Existing scoped spending and session-key work stays in its current hubs unless a later planning
  pass deliberately moves ownership.
- Any persisted state, public contracts, auth/session/permit/policy changes, or runtime/toolchain
  boundary changes need explicit human judgment callouts before implementation.

## Notes For Agents

- Claude should focus on advanced/operator UI only: run ledger inspection, pause/stop/revoke
  controls, policy visibility, and clear explanatory copy for trusted users.
- Codex should focus on shared/runtime primitives only: agent run ledger, tool decision records,
  cancellation/revocation semantics, and durability proof for browser runtime recovery.
- Shared assumptions:
  - This hub is backlog-only until intentionally promoted.
  - This save must not change runtime behavior.
  - Existing related hubs are references, not edit targets.
  - Default Coop UX remains approachable for non-technical community/project users.
  - Activation order is run ledger, kill-switch semantics, runtime durability proof, advanced UI,
    then operator reference docs.
