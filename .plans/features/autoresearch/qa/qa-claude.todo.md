---
feature: autoresearch
title: QA Pass 2 — E2E & UX Review
lane: qa
agent: claude
status: blocked
qa_order: 2
source_branch: feature/autoresearch
work_branch: qa/claude/autoresearch
handoff_in: handoff/qa-claude/autoresearch
depends_on:
  - ./qa-codex.todo.md
  - ../lanes/ui.claude.todo.md
updated: 2026-04-06
---

# QA Pass 2 — E2E & UX Review

## Objective

Validate end-to-end experiment flow, settings persistence, journal rendering, and UX quality.

## Checks

### E2E Flow
- [ ] Full cycle: enable skill → run experiments → journal shows results
- [ ] Settings persist across sidepanel close/reopen
- [ ] "Run Now" shows progress and completes without error
- [ ] Kept variant is used in next live skill execution
- [ ] Reverted variant does not affect live skill execution

### UX Review
- [ ] Settings section is discoverable in Nest tab
- [ ] Toggle labels clearly communicate what autoresearch does
- [ ] Journal cards are scannable (key info visible without expanding)
- [ ] Diff view is readable at sidepanel width
- [ ] Empty states guide the user on what to do next
- [ ] Loading states are present during experiment execution

### Accessibility
- [ ] All interactive elements have focus indicators
- [ ] Toggle switches are keyboard-navigable
- [ ] Screen reader announces toggle state changes
- [ ] Color is not the only indicator for kept/reverted status
- [ ] Contrast meets WCAG 2.1 AA (4.5:1 for text)

### Regression
- [ ] Existing agent cycle is unaffected when autoresearch is disabled
- [ ] No new TypeScript errors introduced
- [ ] No new lint warnings
- [ ] `bun run validate smoke` passes

## Verification

```bash
bun run test
bun run validate smoke
```
