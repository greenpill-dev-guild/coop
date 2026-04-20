---
feature: <feature-slug>
title: <Feature Title> API lane
lane: api
agent: codex
status: backlog
source_branch: <source-branch>
work_branch: codex/api/<feature-slug>
depends_on:
  - ../spec.md
owned_paths:
  - packages/api/src/<replace-me>
done_when:
  - replace-with-concrete-symbol-or-file-evidence
skills:
  - api
  - hono
  - contracts
updated: <YYYY-MM-DD>
---

# API Lane

## Objective

Describe the API/server/message-contract work Codex should own.

`done_when` should use concrete, searchable evidence strings that will exist under `owned_paths`
when the lane is truly complete.
Keep changes inside `owned_paths` where possible. If work spills beyond them, explain why in
`Handoff Notes`.

## Files

- `packages/api/...`
- Shared request/response contracts
- Runtime message handlers if affected

## Tasks

- [ ] Update request/response contracts
- [ ] Implement route or handler changes
- [ ] Add or update API tests
- [ ] Keep work inside `owned_paths` or document justified spillover
- [ ] Capture any migration or rollout notes

## Verification

- [ ] Appropriate validation tier was run
- [ ] Message/route contracts are tested

## Handoff Notes

Anything QA should verify from client to server boundary.
List any human judgment callouts: dependencies, migrations/persisted state, auth/policy changes,
public contracts, runtime/toolchain boundaries, or ownership blur.
