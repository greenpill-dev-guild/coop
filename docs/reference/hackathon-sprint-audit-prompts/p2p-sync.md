---
title: "P2P And Sync Audit Prompt"
slug: /reference/hackathon-sprint-audit-prompts/p2p-sync
audience: builder
doc_type: prompt-pack
status: historical
---

# P2P And Sync Audit Prompt

<DocMeta />

This is an April 1, 2026 snapshot prompt. Refresh commands, coverage, file paths, and repo facts
against the live tree before reusing it.

```text
Audit this repo read-only and produce an Audit Memo focused on peer-to-peer functionality, Yjs sync, relay behavior, connection states, and sync observability.

Repo: /Users/afo/Code/greenpill/coop
Snapshot context: April 1, 2026. Refresh the baseline against the live repo before treating any fact below as current.

Snapshot repo facts from April 1, 2026; refresh before use and treat as context, not proof:
- Coop sync logic lives in `packages/shared/src/modules/coop/sync.ts`.
- Receiver sync logic lives in `packages/shared/src/modules/receiver/sync.ts`.
- Blob relay and peer transfer logic live in `packages/shared/src/modules/blob`.
- API websocket and Yjs server logic live in `packages/api/src/ws/yjs-sync.ts`.
- User-facing sync summaries are exposed through extension and app surfaces, not only the transport layer.

Operating rules:
- Stay read-only.
- Read docs, transport code, UI state derivation, and tests before judging the sync model.
- Distinguish documented intent from current implementation.
- For every material claim, cite at least one file path and one command you ran.
- If you identify missing connection states, explain whether the gap is in transport logic, status modeling, UI mapping, or test coverage.

Start by reading:
- `/Users/afo/Code/greenpill/coop/AGENTS.md`
- `/Users/afo/Code/greenpill/coop/docs/builder/p2p-functionality.md`
- `/Users/afo/Code/greenpill/coop/docs/builder/integrations/yjs.md`
- `/Users/afo/Code/greenpill/coop/docs/reference/receiver-pairing-and-intake.md`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/modules/coop/sync.ts`
- `/Users/afo/Code/greenpill/coop/packages/shared/src/modules/receiver/sync.ts`
- `/Users/afo/Code/greenpill/coop/packages/api/src/ws/yjs-sync.ts`

Then inspect:
- `packages/shared/src/modules/blob/channel.ts`
- `packages/shared/src/modules/blob/relay.ts`
- `packages/extension/src/background/dashboard.ts`
- `packages/extension/src/views/Popup/helpers.ts`
- `packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
- `packages/app/src/hooks/useReceiverSync.ts`
- sync-related tests in `packages/api/src/ws/__tests__`, `packages/shared/src/modules/receiver/__tests__`, `packages/shared/src/modules/blob/__tests__`, `e2e/receiver-sync.spec.cjs`, and `e2e/sync-resilience.spec.cjs`

Required checks:
1. Build a concrete connection-state model that covers:
   - local-only
   - signaling-ready
   - peer-connected
   - degraded
   - reconnecting
   - persisted-state or reload recovery
2. Identify whether those states are represented as typed state, prose strings, or mixed approaches.
3. Review whether sync health is derived from transport facts or from UI copy heuristics.
4. Review failure handling for:
   - no signaling
   - offline
   - websocket fallback
   - malformed payloads
   - dropped peers
   - room cleanup
   - multi-peer and late-join synchronization
5. Review observability and whether the current code can explain sync state clearly to users and maintainers.
6. Identify missing tests for multi-peer, full resync, reconnect, and state-persistence paths.

Suggested commands:
- `sed -n '1,260p' packages/shared/src/modules/coop/sync.ts`
- `sed -n '1,240p' packages/shared/src/modules/receiver/sync.ts`
- `sed -n '1,260p' packages/api/src/ws/yjs-sync.ts`
- `sed -n '140,250p' packages/extension/src/background/dashboard.ts`
- `sed -n '1,260p' packages/extension/src/views/Popup/helpers.ts`
- `sed -n '1,220p' packages/extension/src/views/Sidepanel/hooks/useSyncBindings.ts`
- `sed -n '1,240p' packages/app/src/hooks/useReceiverSync.ts`
- `rg -n "syncState|syncDetail|signaling|peer|offline|degraded|local-only|connected to|ready when another peer joins" packages/shared packages/extension packages/app packages/api e2e --glob '!**/dist/**'`

Deliverable format:

# Audit Memo

## Current State
- Summarize the intended sync architecture.
- Summarize the actual sync architecture in code today.

## Connection State Model
- Provide a table with:
  - state name
  - source of truth
  - trigger or transition
  - user-visible wording
  - persistence behavior
  - known gaps

## Findings
- Order findings by severity.
- Include evidence from transport code, UI mapping, and tests.

## Strengths Worth Preserving
- Call out robust transport or testing choices worth keeping.

## Gaps Or Unknowns
- Note what would still require live network or multi-browser validation.

## Prioritized Next Steps
- Give the most important next steps with short rationale.

Hard requirements:
1. End with top findings ordered by severity.
2. Include strengths worth preserving.
3. Include gaps or unknowns.
4. Include prioritized next steps with short rationale.
5. Explicitly separate documented intent from current implementation.
```
