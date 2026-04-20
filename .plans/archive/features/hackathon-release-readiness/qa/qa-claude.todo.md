---
feature: hackathon-release-readiness
title: Hackathon release QA pass 2
lane: qa
agent: claude
status: done
source_branch: main
work_branch: qa/claude/hackathon-release-readiness
depends_on:
  - qa-codex.todo.md
  - ../lanes/docs.claude.todo.md
tags:
  - Testing
  - Demo
  - Polish
  - Documentation
skills:
  - qa
  - ui
  - e2e
qa_order: 2
handoff_in: handoff/qa-claude/hackathon-release-readiness
updated: 2026-03-30
---

# QA Pass 2

## Category

Testing, manual UX acceptance, and demo rehearsal.

## Focus

- user trust and clarity
- landing/install/docs sanity
- demo flow smoothness
- polish triage after the technical gate is green

## Tasks

- [ ] Walk the full story: landing -> install -> create or join -> passkey explanation -> pair
      device -> synthesize in Chickens -> invite/share -> archive/Filecoin -> Green Goods
      touchpoint.
- [ ] Check that privacy and local-first claims feel explicit and believable to a first-time user.
- [ ] Rehearse the demo flow and trim wording or sequencing friction where needed.
- [ ] Record only high-signal issues in `../eval/qa-report.md`, clearly separating blockers from
      nice-to-have polish.

## Verification

- [ ] Manual walkthrough completed
- [ ] Docs/install path sanity-checked
- [ ] Findings captured with a clear blocker vs polish split
