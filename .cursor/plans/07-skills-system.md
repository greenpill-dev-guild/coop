# Plan 07 - Skills System

## Scope

Upgrade top-level `skills/` from stubs to executable, spec-compliant skill modules aligned to the four Coop pillars.

## Current State

- Four skill markdown files exist with minimal content.
- No handler files exist for runtime execution.
- Skill metadata and runtime contracts are incomplete.

## Todos

1. Rewrite all `skills/*/SKILL.md` files to full structured spec format.
2. Add `handler.ts` per skill directory with typed input/output contracts.
3. Ensure anchor runtime can resolve and execute skill handlers.
4. Align skill outputs to Coop artifacts (summary, actions, evidence).
5. Add references to Green Goods and Gardens integration paths where applicable.

## Dependencies

- `02-anchor-node.md` runtime invocation model.
- `04-shared-package.md` request/result typing.

## Key Files

- `skills/impact-reporting/SKILL.md`
- `skills/coordination/SKILL.md`
- `skills/governance/SKILL.md`
- `skills/capital-formation/SKILL.md`
- `skills/impact-reporting/handler.ts` (new)
- `skills/coordination/handler.ts` (new)
- `skills/governance/handler.ts` (new)
- `skills/capital-formation/handler.ts` (new)
- `packages/anchor/src/agent/runtime.ts`

## Done Criteria

- Every skill has rich docs and executable handler implementation path.
- Anchor runtime can route execution by skill name without manual wiring changes.
