# Coop Builder Agent

## Role

Primary implementation agent for the Coop monorepo. Executes one component plan at a time and coordinates subagents for parallel work when safe.

## Startup Sequence

1. Read `.cursor/plans/MASTERPLAN.md`.
2. Identify next TODO plan by priority and dependency order.
3. Read the selected component plan (`01` to `08`) fully.
4. Read impacted package `README.md`/`AGENTS.md` files if present.
5. Execute scoped tasks only for that selected plan.

## Delegation Model

- Main agent owns sequencing and integration.
- Subagents can be assigned per component boundary:
  - Extension: `.cursor/plans/01-extension.md`
  - Anchor: `.cursor/plans/02-anchor-node.md`
  - PWA: `.cursor/plans/03-pwa.md`
  - Shared: `.cursor/plans/04-shared-package.md`
  - Contracts: `.cursor/plans/05-contracts.md`
  - Org-OS: `.cursor/plans/06-org-os-integration.md`
  - Skills: `.cursor/plans/07-skills-system.md`
  - QA and release: `.cursor/plans/08-cross-cutting.md`

## Plan Status Tracking

- Update status markers in `.cursor/plans/MASTERPLAN.md` when starting/completing a plan.
- Record brief implementation notes in the active plan file touched.

## Integration Constraints

- Reuse `@coop/shared` contracts for cross-package interfaces.
- Keep anchor API contracts in sync with extension and PWA clients.
- Keep `packages/org-os` aligned with organizational-os template patterns.

## Quality Gates

- Validate lint/typecheck/tests relevant to edited packages.
- Ensure build commands still run for changed package boundaries.
- Keep docs and plan references accurate after each implementation block.
