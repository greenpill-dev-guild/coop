---
title: "Structure Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/structure
audience: builder
doc_type: prompt-pack
status: historical
---

# Structure Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on file and folder structure, naming conventions, and code structure.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- `bun run validate quick` passed on April 1, 2026.
- The repo is a Bun monorepo with major code in `packages/shared`, `packages/app`, `packages/extension`, and `packages/api`.
- A sidecar `packages/contracts` folder also exists and should be assessed against the documented architecture rather than ignored.

Operating rules:
- Stay read-only. Do not edit files, write plans, or propose code patches.
- Read code and docs first. Do not infer from filenames alone.
- Distinguish documented intent from current implementation in every major section.
- For every material claim, cite at least one file path and one command you ran.
- Prefer `rg`, `find`, `sed -n`, `wc -l`, `git log`, and other non-mutating commands.
- Ignore generated outputs unless they materially affect the structure story.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/CLAUDE.md`
- `/Users/afo/Code/greenpill/coop/package.json`
- `/Users/afo/Code/greenpill/coop/.plans/README.md`

Then inspect:
- workspace and package layout
- `scripts/`
- `.plans/`
- `docs/reference/`
- `packages/*/src`
- barrel exports and package entrypoints

Required checks:
1. Compare the documented package architecture against the actual workspace layout.
2. Identify naming drift, boundary drift, and any folders that behave like packages without being treated like first-class packages.
3. Identify oversized source files and explain whether they represent justified concentration or structural debt.
4. Review whether public APIs and barrel exports are disciplined or overly broad.
5. Review whether the current folder layout helps a new contributor find the right write surface quickly.
6. Call out docs-vs-reality mismatches such as sidecar or legacy surfaces that are still active in practice.

Suggested commands:
- `find packages -maxdepth 2 -type d | sort`
- `find .plans -maxdepth 4 -type f | sort | head -n 200`
- `find docs/reference -maxdepth 2 -type f | sort`
- `find packages -path '*/src/*.ts' -o -path '*/src/*.tsx' | grep -v '/dist/' | xargs wc -l | sort -nr | head -n 40`
- `rg -n "workspaces|build|validate|plans" package.json AGENTS.md CLAUDE.md`
- `rg --files packages/shared/src packages/app/src packages/extension/src packages/api/src`

Deliverable format:

# Audit Memo

## Current State
- Summarize the actual structure in 1 short paragraph.
- Summarize the documented intent in 1 short paragraph.
- State where they align and where they diverge.

## Findings
- Order findings by severity.
- For each finding include:
  - title
  - why it matters
  - evidence with file-path citations
  - command evidence in backticks
  - whether it is a docs problem, structure problem, or both

## Strengths Worth Preserving
- Call out what is already working well structurally.

## Gaps Or Unknowns
- List anything that could change the conclusion if inspected further.

## Prioritized Next Steps
- Give a short, decision-oriented list of next steps with rationale.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
