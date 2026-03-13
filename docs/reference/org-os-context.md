# Org-OS Context (Reference-Only)

Date: 2026-03-13
Status: reference only (not active runtime scope)

## Why this file exists

`origin/release/0.0` narrowed hackathon runtime scope to a smaller package set. This file preserves Org-OS historical context so humans and agents can stay aware without re-expanding v1 scope by accident.

## Current active runtime shape (release/0.0)

Tracked package set:

- `packages/app`
- `packages/extension`
- `packages/issuer`
- `packages/shared`

Org-OS is **not** part of the active tracked package set on `origin/release/0.0`.

## Historical location in earlier scaffold

In earlier monorepo scaffold versions (`origin/main` and archived planning branches), Org-OS lived in:

- `packages/org-os/*`

and was referenced in docs/plans such as:

- `README.md` (historical versions)
- `docs/coop-component-plans.md`
- `.cursor/plans/06-org-os-integration.md` (archived planning)

## Archive pointers (preserved before release alignment)

Before aligning local work to latest `origin/release/0.0`, the branch state was archived here:

- Archive branch: `archive/pre-align-release-0.0-20260313-110510`
- Archive tag: `archive-pre-align-release-0.0-20260313-110510`
- Git bundle: `.archives/git/archive-pre-align-release-0.0-20260313-110510.bundle`

## Reintroduction guide (later scope)

If/when Org-OS is reintroduced, do it as an explicit scoped milestone:

1. Decide target role first (reference schemas only vs active package/runtime integration).
2. Add package and dependency boundaries (no accidental runtime coupling).
3. Define minimal integration contract in `packages/shared`.
4. Add explicit validation suites and CI checks.
5. Update architecture docs and this file to reflect active status.
