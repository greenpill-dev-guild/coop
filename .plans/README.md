# Plans

`.plans/` is the single live planning space for active work.

- Active feature work lives in `.plans/features/<feature-slug>/`
- Archived or superseded feature packs live in `.plans/archive/features/<feature-slug>/`
- Other archived or superseded plan files live elsewhere under `.plans/archive/`
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

Historical lane files may still exist with non-default agent suffixes when they were created before
the current ownership rules or migrated from older planning flows. Treat those as historical
exceptions, not as a template for new work.

## Feature Pack Shape

```text
.plans/features/<feature-slug>/
  spec.md
  context.md
  status.json          # Required machine-readable lane state (see below)
  lanes/
    <lane>.<agent>.todo.md
  qa/
    qa-codex.todo.md
    qa-claude.todo.md
  eval/
    implementation-notes.md
    qa-report.md
```

Template: `.plans/templates/status.json`

Supported lane-file lanes:

- `ui`
- `state`
- `api`
- `contracts`
- `docs`
- `qa`

Canonical `status.json` lanes:

- `ui`
- `state`
- `api`
- `contracts`
- `docs`
- `qa_pass_1`
- `qa_pass_2`

## Statuses

- `backlog` — not started
- `n/a` — lane not applicable for this feature
- `ready` — clear to start when an agent is available
- `in_progress` — work underway
- `blocked` — waiting on dependencies
- `in_review` — work complete, awaiting review
- `done` — lane finished and verified
- `archived` — feature archived

## status.json

Machine-readable state for each feature hub. Enables CI polling and automatic lane transitions.

```json
{
  "feature": "my-feature",
  "title": "My Feature",
  "stage": "active",
  "lanes": {
    "ui": {
      "owner": "claude",
      "status": "backlog",
      "depends_on": [],
      "branch": "claude/ui/my-feature",
      "ready_when_dependencies_met": true
    },
    "docs": {
      "owner": "codex",
      "status": "n/a",
      "depends_on": [],
      "branch": "codex/docs/my-feature"
    },
    "qa_pass_1": {
      "owner": "codex",
      "status": "blocked",
      "depends_on": ["ui", "state"],
      "branch": "handoff/qa-codex/my-feature",
      "branch_trigger": "handoff/qa-codex/my-feature",
      "ready_when_dependencies_met": true
    }
  },
  "decisions": [
    { "id": "D1", "choice": "Use Yjs for sync", "rationale": "CRDT fits local-first model" }
  ],
  "updated_at": "2026-04-02"
}
```

### Fields

- **`stage`**: `active` | `backlog`
- **`lanes.*.status`**: `backlog` | `n/a` | `ready` | `in_progress` | `blocked` | `in_review` | `done` | `archived`
- **`lanes.*.depends_on`**: Array of lane names that must complete first
- **`lanes.*.branch_trigger`**: Branch name that, when it exists, signals this lane can start
- **`lanes.*.ready_when_dependencies_met`**: Marker that the lane can be promoted from `blocked` to `ready` after dependency review; it is not an automatic status mutation by itself
- **`decisions`**: Array of `{ id, choice, rationale }` — architecture decision log for the feature

### Usage

Update `status.json` and the matching lane frontmatter in the same change. Active packs are considered inconsistent until both agree.

```bash
# List features with available work for an agent
bun run plans queue --agent claude --lane ui

# After completing a lane, update status.json, the lane file, and any eval/qa notes
# Use reconcile output as a review aid, not as permission to skip that metadata update
```

## Release-Truth Rule

When the staged-launch or live-rails posture changes, update these in the same change:

- `.plans/features/production-readiness/status.json`
- `.plans/features/production-readiness/eval/qa-report.md`
- `docs/reference/current-release-status.md`

Release-reference docs must never claim a greener state than `production-readiness`.

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

`owned_paths` are the lane's primary ownership boundary, not a loose suggestion. If implementation
must expand beyond them, split the work when possible and otherwise call out the justified spillover
in lane handoff notes and review.

Implementation and QA handoffs should explicitly surface any human judgment callouts:

- dependencies
- migrations or persisted-state changes
- auth / session / permit / policy changes
- public contract or cross-package boundary changes
- runtime / provider / toolchain boundary changes
- ownership blur or mixed-concern diffs

Automations should use `bun run plans reconcile ...` before implementation so stale `ready` lanes can be marked `done`, ambiguous evidence can be blocked for review, and metadata drift can surface as inbox items instead of silently re-queuing inconsistent work.
