# Agentic Flow Hardening

**Feature**: `agentic-flow-hardening`
**Status**: Active
**Source Branch**: `feature/agentic-flow-hardening`
**Created**: `2026-05-26`
**Last Updated**: `2026-05-26`

## Summary

Close the agentic-flow gaps identified from the Syntax transcript review without adding a parallel process. The first pass strengthens Coop's existing Planning OS, schema contracts, design guidance, and import-boundary visibility while staying advisory by default.

## Why Now

- Coop already has strong `.plans`, lane ownership, and human judgment callouts, but the review found a few drift-prone seams that agents can still exploit.
- The highest-value fixes are small and structural: make pre-agent readiness explicit, schema the API/WS boundary, correct route docs drift, clarify extension CSS ownership, and surface shared import-boundary drift.

## Scope

### In Scope

- Add an `Agent Readiness` checklist to the feature template.
- Add a scaffolded docs lane template.
- Add shared Zod schemas for ICE and signaling envelopes.
- Wire API and shared client parsing through those schemas without changing route paths or WebSocket message names.
- Add a non-blocking `check:agentic-flow` advisory import-boundary check.
- Update app route context and extension design guidance.
- Migrate the remaining flat legacy landing polish note into a canonical feature pack.

### Out Of Scope

- Blocking CI gates for import-boundary findings.
- Validation-library migration away from Zod.
- New UI component framework or extension-specific DesignMD file.
- Any Dexie/Yjs persisted schema changes.
- Implementing the landing-closing-polish UI changes.

## User-Facing Outcome

- Maintainers and agents get clearer readiness prompts before implementation and clearer advisory feedback when imports bypass public shared surfaces.
- End-user product behavior stays the same in this pass.

## Technical Notes

- Primary surfaces: `.plans/templates`, `packages/shared/src/contracts`, `packages/api/src`, `packages/shared/src/sync-config.ts`, `scripts`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, and `.claude/context/app.md`.
- Shared module boundary remains public exports from `@coop/shared` and deliberate package subpaths in `packages/shared/package.json`.
- Wire compatibility is required: `/sync/ice`, rate-limit responses, and WebSocket signaling message names keep their current shapes.

## Agent Readiness

- [x] Data shape is described before implementation; no Dexie/Yjs persisted-state impact.
- [x] Validation boundary is Zod at shared sync contracts plus API/shared client parsing.
- [x] Route or surface map is explicit in `.claude/context/app.md`.
- [x] Auth, session, permit, policy, and approval implications are `None`.
- [x] Client/server and sync message paths are `/sync/ice`, `fetchServerMintedIceConfig`, and API WebSocket signaling.
- [x] UI/CSS primitive guidance stays in root `DESIGN.md` Extension Appendix and existing extension global CSS.
- [x] Folder placement and public import surfaces are named before new files are introduced.
- [x] Verification tier is targeted contract/API/script tests plus `validate:smoke`.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | Extension design appendix and app route context correction |
| State | Codex | Planning templates, legacy plan migration, advisory script wiring |
| API | Codex | `packages/api`, signaling parser consumption, ICE response validation |
| Contracts | Codex | Shared sync Zod schemas and inferred types |
| Docs | Codex | Durable guidance consolidation after implementation lanes |
| QA 1 | Codex | Plan, contracts, API, and script verification |
| QA 2 | Claude | Human-readable workflow and design guidance review |

## Acceptance Criteria

- [x] `agentic-flow-hardening` exists as the canonical feature pack.
- [x] Feature templates include `Agent Readiness` and a docs lane template.
- [x] ICE and signaling boundary schemas are exported from shared contracts.
- [x] API and shared sync client parsing use the shared schemas without wire-shape changes.
- [x] `check:agentic-flow` reports disallowed shared subpath imports across package source/tests and stays advisory by default.
- [x] Route docs and extension design guidance no longer point agents at stale or missing dialect context.
- [x] The flat legacy landing polish note is preserved in `.plans/features/landing-closing-polish/`.

## Validation Plan

- Unit: `vitest run packages/shared/src/contracts/__tests__/schema-sync.test.ts packages/api/src/routes/__tests__/sync.test.ts packages/api/src/ws/__tests__/handler.test.ts`
- Planning/checks: `vitest run scripts/__tests__/plans.test.ts scripts/__tests__/check-agentic-flow.test.ts`
- Plan integrity: `bun run plans:validate` and `bun run plans:legacy`
- Design/checks: `bun run check:design-md`, `bun run check:design-tokens`, `bun run check:agentic-flow`
- Final confidence: `bun run validate:smoke`
- Browser proof: not required because this pass changes guidance, contracts, checks, and API parsing, not user-facing UI behavior.

## References

- Related docs: `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/context/app.md`, `.plans/README.md`
- Relevant files: `.plans/templates/feature/`, `packages/shared/src/contracts/schema-sync.ts`, `packages/shared/src/sync-config.ts`, `packages/api/src/routes/sync.ts`, `packages/api/src/ws/handler.ts`, `scripts/check-agentic-flow.ts`
- Open questions: None for v1 advisory implementation.
