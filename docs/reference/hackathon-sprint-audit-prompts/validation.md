---
title: "Audit Prompt Pack Validation"
slug: /reference/hackathon-sprint-audit-prompts/validation
audience: builder
doc_type: prompt-pack
status: historical
---

# Audit Prompt Pack Validation

<DocMeta />

Snapshot date: April 1, 2026

This note records the dry-run validation used while authoring the audit prompt pack. It is a
historical snapshot, not evidence that the current repo still matches the April 1 findings.

## Method

Two prompts were dry-run manually against the repo as it existed on April 1, 2026:

- structure, naming, and code organization
- P2P, Yjs, sync, and connection states

The goal was not to produce final audits. The goal was to verify that the prompts naturally force:

- repo-specific evidence
- file-path citations
- command citations
- concrete risks and next steps

## Dry Run: Structure Prompt

Commands used:

- `find packages -maxdepth 2 -type d | sort`
- `sed -n '1,220p' AGENTS.md`
- `sed -n '1,260p' package.json`
- `find packages -path '*/src/*.ts' -o -path '*/src/*.tsx' | grep -v '/dist/' | xargs wc -l | sort -nr | head -n 35`
- `sed -n '1,220p' packages/contracts/package.json 2>/dev/null || echo 'no package.json'`
- `rg -n "packages/contracts|contracts/" package.json scripts packages .github --glob '!**/node_modules/**' --glob '!**/dist/**' | head -n 160`

The prompt produced concrete, repo-specific findings instead of generic advice. The most useful
examples were:

- documented architecture vs actual workspace mismatch:
  - the shared docs describe four primary packages, but `packages/contracts` exists as an active
    sidecar surface without a `package.json`
  - evidence:
    - `AGENTS.md`
    - `package.json`
    - `scripts/deploy-registry.ts`
    - `packages/shared/src/modules/fvm/fvm.ts`
- large-file concentration that is structural rather than cosmetic:
  - `packages/extension/src/runtime/agent/runner-skills.ts`
  - `packages/app/src/views/Landing/index.tsx`
  - `packages/extension/src/background/handlers/archive.ts`

Result: pass. The prompt reliably pulled out concrete structure risks, cited files, and gave
prioritized next steps without needing extra interpretation.

## Dry Run: P2P And Sync Prompt

Commands used:

- `sed -n '1,260p' packages/shared/src/modules/coop/sync.ts`
- `sed -n '500,680p' packages/shared/src/modules/coop/sync.ts`
- `sed -n '1,240p' packages/shared/src/modules/receiver/sync.ts`
- `sed -n '1,260p' packages/api/src/ws/yjs-sync.ts`
- `sed -n '140,250p' packages/extension/src/background/dashboard.ts`
- `sed -n '1,260p' packages/extension/src/views/Popup/helpers.ts`
- `sed -n '1,220p' packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
- `sed -n '1,140p' packages/extension/src/runtime/messages.ts`
- `rg -n "syncState|syncDetail|signaling|peer|offline|degraded|local-only|connected to|ready when another peer joins" packages/shared packages/extension packages/app packages/api e2e --glob '!**/dist/**' | head -n 260`

The prompt also produced concrete, repo-specific risks instead of generic sync commentary. The most
useful examples were:

- transport health is typed in shared, but user-facing sync status becomes stringly typed higher up
  the stack:
  - `packages/shared/src/modules/coop/sync.ts`
  - `packages/extension/src/runtime/messages.ts`
  - `packages/extension/src/background/dashboard.ts`
- popup sync presentation currently depends on matching prose fragments like "connected to" or
  "ready when another peer joins", which makes state mapping brittle if wording changes:
  - `packages/extension/src/views/Popup/helpers.ts`
- receiver capture sync states are typed at the capture level, but runtime health and coop sync
  states are modeled separately, which is useful but easy to conflate unless the audit forces a
  full state model:
  - `packages/app/src/components/SyncPill.tsx`
  - `packages/app/src/hooks/useReceiverSync.ts`

Result: pass. The prompt reliably generated a state-model-oriented review instead of a generic Yjs
essay, and it surfaced concrete risks around state representation, observability, and UI mapping.

## Conclusion

The pack clears the intended bar:

- it forces code-first inspection
- it forces file and command citations
- it produces concrete, repo-specific findings
- it naturally yields prioritized next steps without needing further interpretation
