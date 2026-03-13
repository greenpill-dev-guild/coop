# Org-OS + React Flow Context (Reference-Only)

Date: 2026-03-13
Status: reference only (not active runtime scope)

## Why this file exists

`origin/release/0.0` narrowed the hackathon runtime to a smaller set of packages and delivery paths. This file preserves context so humans and agents can stay aware of prior Org-OS and React Flow plans without re-expanding v1 scope by accident.

## Current active runtime shape (release/0.0)

Tracked package set:

- `packages/app`
- `packages/extension`
- `packages/issuer`
- `packages/shared`

Org-OS is **not** part of the active tracked package set on `origin/release/0.0`.

React Flow is still present in release/0.0 as a **read-oriented board surface** and in planning/docs references.

## Historical location of Org-OS in earlier scaffold

In the earlier monorepo scaffold (`origin/main` and archived planning branches), Org-OS lived in:

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

These contain the planning artifacts (including React Flow and Org-OS planning docs) that were not kept in active runtime scope.

## Reintroduction guide (later scope)

If/when Org-OS is reintroduced, do it explicitly as a scoped milestone:

1. Decide target role first (reference schemas only vs active package/runtime integration).
2. Add package and dependency boundaries (no accidental runtime coupling).
3. Define minimal integration contract in `packages/shared`.
4. Add explicit validation suites and CI checks.
5. Update architecture docs and this file to reflect active status.

For React Flow, keep v1 expectation clear: read/presentation first; avoid broad editing complexity unless scope is intentionally expanded.
