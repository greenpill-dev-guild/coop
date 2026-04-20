# Autoresearch — Implementation Notes

## Deviations from Spec

| Area | Spec Said | Actual | Why |
|------|-----------|--------|-----|
| Composite weights (experiment-loop) | 0.2/0.3/0.3/0.2 | 0.2/0.3/0.3/0.2 | Initially implemented as 0.16/0.24/0.40/0.20 by Codex (nested weights). Fixed by Claude to match spec. |
| Composite weights (eval.ts runEvalSuite) | 0.2/0.3/0.3/0.2 | 0.2/0.3/0.5 | runEvalSuite uses the eval.ts internal weighting (no feedback term). The experiment loop's scoreOutput applies the spec 4-term formula. |
| Pause/resume | Persistent state across restarts | Ephemeral in-memory Set | Service worker restarts are unpredictable; persisted state would need reconciliation logic. Module-level Set is simpler and sufficient for interactive use. |
| Variant generation | "small perturbations to SKILL.md" | Structured mutation strategies (emphasis swap, output guidance, constraints, structural) | Deterministic strategy rotation ensures experiment diversity without LLM involvement. |
| Timestamps | Spec used z.number() | Kept z.number() (not z.string().datetime()) | Numeric timestamps enable efficient compound index range queries on [skillId+createdAt]. Documented as intentional deviation from project convention. |

## Follow-ups (all completed)

- [x] Wire collectFeedback into draft approval/rejection handlers
- [x] Add structured logging to experiment loop (agentLog with 'experiment' span type)
- [x] Implement pause/resume for experiment cycles
- [x] Replace placeholder variant generation with meaningful prompt mutations
- [x] Author golden eval fixtures for all 3 WebLLM skills (2 additional each, 6 total new)

## Lessons Learned

- fake-indexeddb doesn't support boolean values in compound key ranges — tests using `[skillId+isActive]` with `true`/`1` must be skipped in CI
- Codex implementations tend to use full-table scans even when indexes exist — always verify query patterns against declared indexes
- Variant generation must produce text that differs from the baseline even for very short prompts — output-appending strategies should come first in the rotation

## 2026-04-09 Metadata Normalization

- Normalized this pack back to the canonical lane model:
  - `api` now tracks the eval harness work
  - `contracts` now tracks the runtime/variant-engine lane
  - `ui` remains open because the sidepanel surface is still being actively refined in the current worktree
- Left QA blocked and unstarted. The prior `status.json` and QA lane metadata overstated completion
  relative to the actual QA report and the live in-flight changes in this repo.
