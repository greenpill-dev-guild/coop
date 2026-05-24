# Adversarial Review Report

## Purpose

Run a read-only review that actively looks for ways agent work could be wrong, leaky, over-scoped, or under-verified in Coop.

## Default High-Risk Surface

Agent runtime, policy/session/permit boundaries, local-first source privacy, and output-contract drift.

## Review Lenses

- Privacy and data leakage.
- Security, auth, permissions, secrets, and destructive operations.
- Public-contract or payload drift.
- UX/accessibility regressions.
- Scope drift or competing truth surfaces.
- Missing verification or unverifiable claims.

## Finding Format

| Severity | Finding | Evidence | Recommendation | Disposition |
|---|---|---|---|---|
| P1 | Evidence artifacts were templates only, so a lane could look complete without a real run ledger or scorecard. | Initial `artifacts/agent-run-ledger.md` and `artifacts/workflow-scorecard.md` had blank templates. | Record the scaffold-hardening lane as the first measured lane and keep product adoption as future work. | closed |
| P2 | `ready` lanes could enter the automation queue before their own evidence existed. | Initial `status.json` marked state, UI, and docs ready. | Mark state `done`; move UI/docs to `backlog` until intentionally started. | closed |
| P2 | Validation commands mixed commands with prose. | Initial eval contained `bun run validate quick when later non-plan files change`. | Split executable commands from run conditions. | closed |
| P3 | Runtime proof could be overstated because this pass only changes plan artifacts. | No package, extension, API, or browser files were touched. | Keep proof limits explicit in eval and closeout. | no-action |

## Proof Limit

This report is read-only. It does not authorize fixes unless the user explicitly approves implementation.
