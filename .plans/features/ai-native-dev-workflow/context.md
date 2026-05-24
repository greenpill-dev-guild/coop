# Context For AI-Native Developer Workflow

## Existing References

- `.plans/features/agent-control-plane/` already defines future run-ledger and stop/revoke semantics.
- `.plans/features/agent-judgment-cues/` codified human judgment re-entry points.
- `.claude/standards/output-contracts.md` defines review output shape and Human Judgment Callouts.
- `.codex/agents/*.toml` defines local agent role profiles.

## Constraints

- Keep `.plans/features` as Coop's execution truth.
- Do not add a cross-repo coordination document that competes with this hub.
- Keep raw prompts, secrets, source bodies, private context, and tokens out of ledgers.
- Treat the first adoption as evidence gathering, not runtime feature work.

## First Candidate Feature

Default candidate: `agent-control-plane`, because it already owns future run-ledger and runtime-control semantics. If that would mix too much runtime planning into process rollout, use `agent-judgment-cues` as the recent baseline instead.
