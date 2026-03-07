# Plan 08 - Cross-Cutting Delivery

## Scope

Cover environment setup, dependency graph, testing, and release-readiness across all Coop packages.

## Todos

1. Add `.env.example` with required variables for anchor, storage, and chain.
2. Ensure `turbo.json` encodes package dependency order.
3. Add test scaffolding:
   - Anchor integration tests
   - Shared package unit tests
   - Contracts Foundry tests
4. Define extension and PWA manual QA checklist.
5. Finalize submission checklist and demo runbook in docs.

## Key Files

- `.env.example` (new)
- `turbo.json`
- `packages/anchor/*test*` (new)
- `packages/shared/*test*` (new)
- `packages/contracts/test/*`
- `docs/pitch/hackathon-submission-checklist.md`
- `docs/pitch/demo-flows.md`

## Suggested Validation Commands

```bash
pnpm check
pnpm build
pnpm lint
pnpm --filter @coop/anchor test
pnpm --filter @coop/shared test
cd packages/contracts && forge test
```

## Done Criteria

- Workspace has reproducible setup and test baseline.
- Cross-package dependencies are explicit.
- Demo and submission paths are documented and executable.
