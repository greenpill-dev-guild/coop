---
title: "Software Architecture Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/software-architecture
audience: builder
doc_type: prompt-pack
status: historical
---

# Software Architecture Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on software architecture quality across SOLID, DDD, KISS, DRY, and event-driven boundaries.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- Core domain logic is intended to live in `@coop/shared`.
- Surface code lives mainly in `packages/app` and `packages/extension`.
- Runtime message boundaries are significant in the extension architecture.
- The repo already contains some large orchestration files, so assess architecture pragmatically rather than doctrinally.

Operating rules:
- Stay read-only.
- Compare docs and package rules against current code.
- Distinguish documented intent from current implementation.
- For every material claim, cite at least one file path and one command you ran.
- Assess abstractions by whether they pay rent in the current codebase, not by pattern purity.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/docs/builder/architecture.md`
- `/Users/afo/Code/greenpill/coop/docs/reference/coop-os-architecture-vnext.md`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/index.ts`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/modules/index.ts`
- `/Users/afo/Code/greenpill/coop/packages/extension/src/runtime/messages.ts`

Then inspect:
- shared domain modules
- app and extension surfaces that consume shared logic
- background handlers, runtime message surfaces, and large orchestration files
- any obvious duplication seams across packages

Required checks:
1. Evaluate whether business logic is actually centered in `@coop/shared` or has leaked into app or extension surfaces.
2. Evaluate whether event and runtime boundaries are legible, or whether cross-package behavior is hard to trace.
3. Review whether abstractions are simplifying the system or mainly adding ceremony.
4. Identify meaningful duplication and distinguish it from healthy local specialization.
5. Identify complexity hotspots and decide whether they should be split, simplified, or left alone.
6. Use SOLID, DDD, KISS, DRY, and EDA as lenses, but stay concrete and repo-specific.

Suggested commands:
- `find packages/shared/src/modules -maxdepth 2 -type d | sort`
- `find packages/extension/src -maxdepth 3 -type d | sort`
- `rg -n "from '@coop/shared'" packages/app packages/extension --glob '!**/dist/**'`
- `rg -n "chrome\\.runtime|sendRuntimeMessage|onMessage|report-sync-health|persist-coop-state" packages/extension packages/app --glob '!**/dist/**'`
- `find packages -path '*/src/*.ts' -o -path '*/src/*.tsx' | grep -v '/dist/' | xargs wc -l | sort -nr | head -n 40`
- `rg -n "TODO|FIXME|HACK" packages --glob '!**/node_modules/**' --glob '!**/dist/**'`

Deliverable format:

# Audit Memo

## Current State
- Summarize the architectural shape the docs promise.
- Summarize the architectural shape the code actually shows.

## Boundary Review
- Cover:
  - shared vs surface logic
  - runtime and event boundaries
  - duplication vs specialization
  - complexity hotspots

## Findings
- Order findings by severity.
- Support each finding with file and command evidence.

## Strengths Worth Preserving
- Call out architecture choices that are paying rent today.

## Gaps Or Unknowns
- Note anything that would require deeper runtime tracing or live verification.

## Prioritized Next Steps
- Give a short list of the most leverageful simplifications or boundary fixes.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
