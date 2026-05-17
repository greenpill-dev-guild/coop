---
title: "Design System Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/design-system
audience: builder
doc_type: prompt-pack
status: historical
---

# Design System Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on design system quality, component reuse, token discipline, accessibility, and consistency across app and extension surfaces.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- Shared design tokens live in `packages/shared/src/styles/tokens.css`.
- App-level components live in `packages/app/src/components`.
- Extension shared UI primitives live in `packages/extension/src/views/shared`.
- Major visual surfaces include the landing page, receiver app, popup, and sidepanel.

Operating rules:
- Stay read-only.
- Read both design docs and code before judging consistency.
- Distinguish documented design intent from current implementation.
- For every material claim, cite at least one file path and one command you ran.
- Evaluate design pragmatically: consistency, reuse, accessibility, and intentional divergence matter more than abstract purity.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/docs/reference/coop-design-direction.md`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/styles/tokens.css`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/styles/a11y.css`

Then inspect:
- `packages/app/src/components`
- `packages/app/src/views/Landing`
- `packages/app/src/views/Receiver`
- `packages/extension/src/views/shared`
- `packages/extension/src/views/Popup`
- `packages/extension/src/views/Sidepanel`

Required checks:
1. Evaluate whether the token system is actually central or only partially enforced.
2. Identify duplicated primitives or near-duplicate patterns between app and extension.
3. Review whether the major surfaces feel like one design system with intentional local adaptations.
4. Review accessibility fundamentals:
   - semantic controls
   - focus treatment
   - responsive behavior
   - motion and reduced-motion handling
5. Identify where component reuse is good, where it is missing, and where reuse would create the wrong abstraction.
6. Compare the design direction docs against the actual implemented surfaces.

Suggested commands:
- `sed -n '1,260p' packages/shared/src/styles/tokens.css`
- `find packages/app/src/components -maxdepth 2 -type f | sort`
- `find packages/extension/src/views/shared -maxdepth 2 -type f | sort`
- `rg -n "var\\(--coop-|panel-card|badge|skeleton|focus-visible|prefers-reduced-motion" packages/app packages/extension packages/shared/src/styles --glob '!**/dist/**'`
- `find packages/app/src/views/Landing packages/app/src/views/Receiver packages/extension/src/views/Popup packages/extension/src/views/Sidepanel -maxdepth 2 -type f | sort`

Deliverable format:

# Audit Memo

## Current State
- Summarize the design system the docs imply.
- Summarize the design system the code actually delivers.

## Reuse And Consistency Map
- Cover:
  - tokens
  - shared primitives
  - surface-specific patterns
  - accessibility and responsiveness

## Findings
- Order findings by severity.
- Use file and command evidence for each claim.

## Strengths Worth Preserving
- Call out system-level strengths, not only polished screens.

## Gaps Or Unknowns
- Note anything that would need live browser verification to confirm.

## Prioritized Next Steps
- Give short, high-leverage next steps with rationale.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
