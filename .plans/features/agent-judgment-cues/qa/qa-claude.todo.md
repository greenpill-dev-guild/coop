---
feature: agent-judgment-cues
title: Passive judgment cues QA pass 2
lane: qa
agent: claude
status: ready
source_branch: main
work_branch: handoff/qa-claude/agent-judgment-cues
qa_order: 2
handoff_in: handoff/qa-claude/agent-judgment-cues
updated: 2026-04-19
---

# QA Pass 2

> Status flipped to `ready` on 2026-04-19 because `qa_pass_1` (codex) is `done`
> and the hardening commit `484078d` exercised the same risk infrastructure
> this pass reviews. See `.plans/audits/2026-04-19-reconciliation.md`.

## Focus

- UX regressions in Roost and Nest review cards
- Human judgment callouts handed off from QA pass 1
- Whether acknowledgement copy and badge weight still match the actual risk threshold

## Tasks

- [ ] Confirm badge density stays readable in Roost and Nest
- [ ] Verify acknowledgement wording feels clear without escalating low-risk chores
- [ ] Review whether any additional high-risk action classes need stronger copy
- [ ] Call out any unresolved human judgment decisions explicitly in `../eval/qa-report.md`
