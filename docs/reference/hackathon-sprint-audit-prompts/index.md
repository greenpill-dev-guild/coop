---
title: "Hackathon Sprint Audit Prompt Pack"
slug: /reference/hackathon-sprint-audit-prompts
audience: builder
doc_type: prompt-pack
status: historical
---

# Hackathon Sprint Audit Prompt Pack

<DocMeta />

Snapshot date: April 1, 2026

This pack preserves the April 1, 2026 post-hackathon stabilization prompts. Treat it as a dated
review snapshot, not as current validation truth. Refresh commands, coverage, file paths, and repo
facts against the live tree before reusing any prompt.

Each prompt is written for a Codex or Claude style repo agent with direct read access to
`/Users/afo/Code/greenpill/coop`.

The prompts are designed to produce an `Audit Memo`, not a vague brainstorm and not an implementation
plan without evidence.

## Snapshot Repo Context

Use these facts as historical context, not as proof that every surface is healthy today:

- `bun run validate quick` passed on April 1, 2026.
- The April 1 root Vitest coverage summary was about `86.1%` lines, `86.1%` statements,
  `86.23%` functions, and `77.04%` branches.
- The repo is a Bun monorepo with a large shared-domain core in `packages/shared`, extension
  runtime and skill surfaces in `packages/extension`, websocket and Yjs server code in
  `packages/api`, and shared design tokens in `packages/shared/src/styles/tokens.css`.
- The browser E2E surface exists, but it is concentrated in a relatively small set of Playwright
  files under `e2e/`.

## Common Contract

Every prompt in this pack requires the reviewer to:

- stay read-only and avoid edits
- read code before drawing conclusions
- compare documented intent against current implementation
- cite both file paths and commands for material claims
- end with:
  - top findings ordered by severity
  - strengths worth preserving
  - gaps or unknowns
  - prioritized next steps with short rationale

If a suite or runtime path is not inspected directly during the audit, it should be described as
unverified rather than assumed healthy.

## Prompts

- [Structure, Naming, and Code Organization](/reference/hackathon-sprint-audit-prompts/structure)
- [Test Quality, Coverage, E2E, and Validation](/reference/hackathon-sprint-audit-prompts/testing)
- [Agent Architecture and Modularity](/reference/hackathon-sprint-audit-prompts/agent-architecture)
- [Design and Component System](/reference/hackathon-sprint-audit-prompts/design-system)
- [P2P, Yjs, Sync, and Connection States](/reference/hackathon-sprint-audit-prompts/p2p-sync)
- [Software Architecture Review](/reference/hackathon-sprint-audit-prompts/software-architecture)
- [CI/CD and Release Quality](/reference/hackathon-sprint-audit-prompts/ci-cd)

## Validation

The pack was dry-run against two high-risk areas:

- [Prompt Pack Validation Notes](/reference/hackathon-sprint-audit-prompts/validation)

Those dry runs were used to confirm that the prompts naturally pull out repo-specific findings,
commands, and evidence rather than generic engineering advice.
