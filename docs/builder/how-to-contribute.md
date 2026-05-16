---
title: How To Contribute
slug: /builder/how-to-contribute
---

# How To Contribute

The repo has strong opinions about boundaries, validation, and scope discipline. This page turns the
internal guidance into a builder-facing contribution path.

## Start With The Real Files

Before changing behavior, open the files that define it. The repo guidance explicitly rejects
speculating about code that has not been read.

That matters most when you are working in:

- `@coop/shared`, where the domain contracts live
- extension background and sidepanel code
- the receiver app shell
- docs pages that summarize runtime behavior

## Keep Shared Logic In `@coop/shared`

The default boundary is:

- shared modules own schemas, flows, sync contracts, and domain logic
- app and extension packages own runtime integration and UI

Prefer imports like:

```ts
import { createCoop, joinCoop } from '@coop/shared';
```

Do not deepen coupling by reaching into internal file paths when the shared package already exposes a
barrel export.

## Use The Repo Conventions

- keep one root `.env.local`
- use `bun run test`, not `bun test`
- surface failures instead of swallowing them
- preserve local-first and passkey-first assumptions unless the task explicitly changes them
- keep docs aligned with the actual runtime behavior rather than aspirational marketing copy

## Validation Before A PR

The repo guidance calls for this baseline:

```bash
bun format && bun lint
bun run test
bun run build
```

For riskier changes, use the named validation suites in `scripts/validate.ts`.

## Docs Contributions

The docs corpus is organized by audience:

- `docs/community/`
- `docs/builder/`
- `docs/reference/`

Community pages should stay plain-language and task-oriented. Builder pages should stay technical and
implementation-aware. Reference pages preserve deeper source material that should not dominate the
main navigation.

## Branch And Commit Conventions

Branches follow `type/description`:

```text
feature/receiver-pwa
fix/sync-race
```

Commits follow Conventional Commits with scope:

```text
feat(shared): add archive receipt schema
fix(extension): resolve sync race in sidepanel
docs(app): update receiver route table
```

Valid types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `ci`.
Common scopes: `shared`, `extension`, `app`, `claude`.

## Good Contribution Hygiene

- prefer small, coherent changes over mixed refactors
- update docs when commands, routes, or runtime assumptions change
- preserve unrelated local changes in your worktree
- keep mock and live modes legible when touching onchain or archive flows

If you are not sure where a change belongs, the package boundary is usually the right first question
to answer.
