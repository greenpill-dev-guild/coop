---
name: migration
description: Deterministic migration wrapper for cross-package breaking changes. Use for dependency-impacting migrations across shared, app, and extension.
disable-model-invocation: true
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: ["testing"]
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Migration Skill

Thin wrapper around the canonical migration protocol.

- Canonical migration protocol: `.claude/agents/migration.md`
- Canonical output contract: `.claude/standards/output-contracts.md`

## Activation

Use when:
- Breaking changes touch multiple packages
- Data model or Dexie schema migrations are required
- Yjs document structure changes that affect peer sync
- Protocol/dependency upgrades need ordered rollout and rollback planning

## Part 1: Deterministic Routing and Blast Radius

1. Identify affected packages and classify impact
2. Produce a blast-radius map before editing:

```bash
grep -rn "ChangedType\|ChangedFunction" packages/ --include="*.ts" --include="*.tsx"
```

3. Classify per-package impact: `breaking | behavioral | compatible`
4. Do not execute migrations until dependency order and rollback path are documented

## Part 2: Execution Order and Validation

Mandatory package order:
1. `shared`
2. `app`
3. `extension`

Per package gate:

```bash
bun --filter <package> build
bun --filter <package> test
```

Cross-package gate:

```bash
bun build
bun lint
bun run test
```

## Part 3: Handoff and Output

Write migration notes to `.plans/migrations/[date]-[name].md` with:
- Summary
- Blast Radius
- Execution Order
- Validation Results
- Risks / Rollback
- Completion Checklist

When using the migration agent, pass a concise handoff with:
- bundle ID
- affected packages
- highest-risk package boundary
- rollback trigger condition

## Anti-Patterns

- Maintaining a second migration protocol that diverges from `.claude/agents/migration.md`
- Skipping blast-radius mapping before edits
- Migrating packages out of dependency order
- Claiming completion without cross-package validation evidence

## Related Skills

- `data-layer` — Dexie schema and Yjs document migration steps
- `testing` — Regression and compatibility checks
