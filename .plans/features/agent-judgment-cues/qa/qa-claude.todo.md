---
feature: agent-judgment-cues
title: Passive judgment cues QA pass 2
lane: qa
agent: claude
status: done
source_branch: main
work_branch: handoff/qa-claude/agent-judgment-cues
qa_order: 2
handoff_in: handoff/qa-claude/agent-judgment-cues
updated: 2026-04-20
---

# QA Pass 2

> Closed `done` on 2026-04-19. Findings and full rationale are in
> `../eval/qa-report.md`.

## Focus

- UX regressions in Roost and Nest review cards
- Human judgment callouts handed off from QA pass 1
- Whether acknowledgement copy and badge weight still match the actual risk threshold

## Tasks

- [x] Confirm badge density stays readable in Roost and Nest
- [x] Verify acknowledgement wording feels clear without escalating low-risk chores
- [x] Review whether any additional high-risk action classes need stronger copy
- [x] Call out any unresolved human judgment decisions explicitly in `../eval/qa-report.md`

## Summary

- 48 targeted tests green (`risk.test.ts`, `review-risk.test.tsx`,
  `operator-console.test.tsx`).
- Threshold and acknowledgement wiring are proportionate.
- Three non-blocking product/UX questions recorded in `../eval/qa-report.md`:
  1. Destructive framing subordinated to permission in ack label.
  2. "Needs Judgment" header fires for publish-only plans (D3 low-risk
     edge case).
  3. Permanent-record onchain actions carry only `[live]`; no dedicated
     permanence cue.
- Visual verification on running dev build not performed; rationale logged
  in the QA report.

## Post-Release Note — 2026-04-20

- The first product-completion simplification pass resolved summary item 2.
- The second product-completion pass resolved summary item 3 with a dedicated
  `permanent-record` cue for irreversible public onchain records.
- Publish, archive, and sync-only plans now stay in approval framing; only
  live, permission, destructive, and permanent-record work keeps “Needs
  Judgment” copy and acknowledgement gating.
- The final product-polish pass resolved summary item 1 by keeping badge order
  stable while making `[permission, destructive]` acknowledgement copy use the
  irreversible-effect wording.
- Final focused validation covered 60 targeted tests across shared risk,
  review helpers, Roost plan cards, Nest helper plans, and Nest waiting chores.
- No QA findings remain open for this pack.
