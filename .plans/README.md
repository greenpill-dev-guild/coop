# Plans

`.plans/` is the single live planning space for active work.

- Active feature work lives in `.plans/features/<feature-slug>/`
- Archived or superseded plan files live in `.plans/archive/`
- Long-lived product and architecture docs stay in `docs/reference/`

## What Automations Should Read

Default queues:

- Claude implementation: `bun run plans queue --agent claude --json`
- Codex implementation: `bun run plans queue --agent codex --json`
- Codex reconciliation preflight: `bun run plans reconcile --agent codex --automation-id codex-core-queue --json`
- Claude docs maintenance: `bun run plans queue --agent claude --lane docs --json`
- Codex docs maintenance: `bun run plans queue --agent codex --lane docs --json`
- Codex QA pass 1: `bun run plans queue --agent codex --lane qa --handoff-ready --json`
- Claude QA pass 2: `bun run plans queue --agent claude --lane qa --handoff-ready --json`

Default ownership:

- Claude: `ui`
- Codex: `state`, `api`, `contracts`
- Both: `docs`
- QA: `qa`

## Feature Pack Shape

```text
.plans/features/<feature-slug>/
  spec.md
  context.md
  lanes/
    <lane>.<agent>.todo.md
  qa/
    qa-codex.todo.md
    qa-claude.todo.md
```

Supported lanes:

- `ui`
- `state`
- `api`
- `contracts`
- `docs`
- `qa`

## Statuses

- `backlog`
- `ready`
- `in_progress`
- `blocked`
- `in_review`
- `done`
- `archived`

## Sequential QA

Use handoff branches:

- `handoff/qa-codex/<feature-slug>`
- `handoff/qa-claude/<feature-slug>`

Codex QA creates the Claude handoff branch when pass 2 should start.

## Commands

```bash
bun run plans validate
bun run plans legacy
bun run plans queue --agent claude
bun run plans queue --agent codex
bun run plans reconcile --agent codex --automation-id codex-core-queue --json
bun run plans queue --agent claude --lane docs
bun run plans queue --agent codex --lane docs
bun run plans queue --agent claude --lane qa --handoff-ready
bun run plans queue --agent codex --lane qa --handoff-ready
```

## Implementation Lane Metadata

Implementation lanes (`state`, `api`, `contracts`) must include:

- `owned_paths`: repo-relative files or directories that define the lane's primary code surface
- `done_when`: concrete, searchable evidence strings that should exist under `owned_paths` once the lane is complete

Automations should use `bun run plans reconcile ...` before implementation so stale `ready` lanes can be marked `done`, ambiguous ones can be blocked for review, and environment failures can surface as inbox items instead of false completion.
