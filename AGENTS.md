# Coop Agent Guide

Coop is a monorepo for a browser-first knowledge commons focused on local and bioregional community coordination.

## Purpose

- Build a Chromium extension and PWA for low-friction capture and voice-first input.
- Run Anchor Node services for stronger AI inference, storage, and orchestration.
- Provide shared skills for impact reporting, coordination, governance, and capital formation.

## Repository Layout

- `packages/extension`: Chromium extension (Manifest V3).
- `packages/pwa`: Mobile companion PWA.
- `packages/anchor`: Anchor node backend and skill runtime.
- `packages/shared`: Shared types, protocol contracts, storage abstractions.
- `packages/contracts`: On-chain registry contracts and account helpers.
- `packages/org-os`: Coop-side organizational OS schema and setup layer.
- `skills`: Coop-native pillar skills.
- `docs`: Architecture, onboarding, pitch docs, and component planning.
- `.cursor/plans`: Main execution roadmap for agents and subagents.

## Session Startup Sequence

At the start of any implementation session:

1. Read `.cursor/plans/MASTERPLAN.md`.
2. Select one active plan (`01`-`08`) based on dependency order and priority.
3. Read the full selected plan file before making edits.
4. Read impacted package files and only modify the scope for that plan.
5. Update plan status markers after completion.

## Planning Sources

- `.cursor/plans/MASTERPLAN.md`: single entrypoint for all development execution.
- `.cursor/plans/00-scaffold-complete.md`: completed baseline scaffold.
- `.cursor/plans/01-extension.md` through `.cursor/plans/08-cross-cutting.md`: implementation plans by subsystem.
- `docs/coop-component-plans.md`: detailed component reference used to derive plan files.

## Build and Development Commands

From repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm check
pnpm format
```

Package-scoped examples:

```bash
pnpm --filter @coop/extension dev
pnpm --filter @coop/anchor dev
pnpm --filter @coop/pwa dev
```

Contracts:

```bash
cd packages/contracts
forge build
forge test
```

## Upstream and Federation References

- Standards source: `03 Libraries/organizational-os` (`packages/framework` and `packages/template`).
- Federation hub and integration reference: `03 Libraries/regen-coordination-os`.
- Meeting scope source: `260305 Luiz X Afo Coffee.md`.

## Working Conventions

- Keep MVP scope focused on capture -> process -> share loops.
- Prefer local-first storage and explicit sync boundaries.
- Maintain package boundaries and shared contracts via `@coop/shared`.
- Keep docs and plans synchronized with implementation changes.

## Safety Rules

- Do not force push or rewrite shared history.
- Do not commit secrets, API keys, or private keys.
- Keep changes scoped to one active plan whenever possible.
- Preserve `CLAUDE.md` as the repo's seed skills/context note.
