# Context For Agentic Flow Hardening

## Existing References

- Transcript review from the Syntax agentic-coding-flow video.
- `.plans/features/ai-native-dev-workflow/` for ledger, scorecard, adversarial-review, and closeout precedent.
- `.plans/adr/ADR-009-agentic-development-friction.md` for scarce-review-attention and human-judgment-callout rationale.
- `.plans/README.md` for canonical feature pack shape, lane statuses, and plan validation.
- `DESIGN.md`, `AGENTS.md`, and `CLAUDE.md` for design and agent guidance.

## Relevant Codepaths

- `.plans/templates/feature/` and `.plans/templates/status.json`
- `.plans/how-can-we-improve-cuddly-kahan.md`
- `packages/shared/src/contracts/schema-sync.ts`
- `packages/shared/src/sync-config.ts`
- `packages/api/src/routes/sync.ts`
- `packages/api/src/ws/handler.ts`
- `packages/api/src/ws/types.ts`
- `scripts/plans.ts`
- `scripts/check-agentic-flow.ts`
- `.claude/context/app.md`
- `DESIGN.md`

## Constraints

- Advisory first: the import-boundary check must exit `0` by default and fail only with `--strict`.
- Preserve current API/WS wire shapes and fallback/drop behavior.
- No Dexie/Yjs persisted-state changes.
- No new UI framework, package-local tokens, package-specific `.env`, or CI-blocking gate.
- Keep `.plans` and `status.json` as execution truth; do not add a parallel workflow ledger.

## Notes For Agents

- Claude should focus on the readability and usefulness of extension design guidance and app route context.
- Codex should focus on templates, schemas, advisory checks, API/shared parsing, and plan validation.
- Shared assumption: this pass hardens the workflow without changing end-user product behavior.
