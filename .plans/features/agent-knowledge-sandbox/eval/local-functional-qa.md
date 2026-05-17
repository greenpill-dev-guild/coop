# Local Functional QA: Context-Graph Memory Loop

Last updated: 2026-05-17

This guide is for Codex, Computer Use, or a human tester validating Coop's browser-native local
knowledge and memory loop. It covers the current v1 path: Dexie-backed source content, Yjs-safe
source registry metadata, snapshot-backed graph memory, local agent traces, and member review gates.
Kuzu-WASM remains deferred.

## Setup

Use the repo root. Do not create package-specific env files.

```bash
bun install
```

Use root `.env.local` defaults for local QA:

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
```

Start the full local environment when testing extension plus receiver/app behavior:

```bash
bun dev
```

For split runs:

```bash
bun dev:app
bun dev:extension
```

Use Browser for `http://127.0.0.1:3001` app/receiver checks. Use Computer Use or the WXT-launched
Chromium window for extension UI checks because Browser cannot load the local unpacked extension
surface by itself.

Focused automation for this guide:

```bash
bun run test:unit:memory-loop
bun run validate memory-loop
bun run validate typecheck
bun run validate quick
```

## Happy Path

1. Start `bun dev` or run `bun dev:app` and `bun dev:extension` in separate terminals.
2. In the WXT Chromium window, open the sidepanel extension surface.
3. Create a coop with a purpose that mentions shared knowledge, evidence, and member review.
4. Open Nest and confirm the coop has a memory charter with goals, desired signals, anti-signals,
   evidence standards, and a confidence threshold.
5. Edit the memory charter and save it. Reopen the coop detail/edit surface and confirm the edit
   persists.
6. In Nest > Sources, add a knowledge source. Prefer a deterministic local-safe source such as an
   RSS fixture URL or a GitHub repo already covered by adapter tests.
7. Toggle the source inactive, then active again. Confirm the source count, active state, freshness,
   and entity count are visible without exposing fetched body text.
8. Refresh/ingest the source. If the live adapter is not deterministic, simulate the runtime message
   path with the existing handler tests and inspect the UI state after the refresh.
9. Confirm the source refresh emits or simulates a `source-content-ready` observation whose payload
   references the persisted `contentId` and labels it `observed/unconfirmed`.
10. Run or observe an agent cycle for the coop. The prepared skill prompt should include the memory
    charter, persisted source content snippets, graph context, precedent context, and any bounded
    confidence adjustment.
11. Open Chickens or Roost and inspect the agent draft. Confirm visible provenance includes source
    labels, `observed/unconfirmed` or graph context labels, precedent signal, and confidence.
12. Promote/approve the draft and publish it.
13. Confirm decision/provenance history changes: the local trace outcome becomes approved, related
    graph edge confidence increases within bounds, and a validated insight summary exists locally.

## Rejection Path

1. Start from an agent-generated draft with source refs and graph context labels.
2. Demote it from ready back to candidate, or reject the agent output from the review surface.
3. Confirm the user-feedback memory records the member action locally.
4. Confirm the latest matching graph trace outcome becomes rejected and related edge confidence is
   weakened within bounds.
5. Confirm no validated insight summary is created from the rejection.
6. Confirm shared coop state and source registry metadata do not gain unconfirmed graph facts.

## Privacy And Trust Checks

1. Inspect the shared Yjs coop document after source add/toggle/remove. It may contain source
   registry metadata, memory charter fields, activity log entries, approved artifacts, and validated
   insight summaries.
2. Confirm shared state does not contain raw source bodies, raw receiver captures, raw prompts, hidden
   chain-of-thought, or unconfirmed graph facts.
3. Inspect Dexie rows for `knowledgeSourceContents`. Rows should show redacted bodies such as
   `Encrypted source content.` while hydrated local reads return the actual body only in local code.
4. Confirm source-content observations and draft provenance use labels such as
   `observed/unconfirmed`, `graph-context`, `inferred/unconfirmed`, `user-confirmed/confirmed`, or
   `stale/stale` where relevant.
5. Remove a source and confirm matching graph entities are marked stale and active relationships are
   invalidated rather than silently deleted from local history.

## Failure-Mode Checks

1. Configure two active sources where the first adapter fails and the second succeeds. Refresh should
   return success for the successful source and log the failed source without halting all refreshes.
2. Refresh a metadata-only source result with an empty body. It should persist a source-content row,
   retain metadata in the encrypted local payload, and still emit a content observation.
3. Remove or disable a source that previously contributed graph entities. Roost/Nest should show
   stale/removed source state where available, and prompt context should label stale memory as stale
   context only.
4. Turn off or make unavailable the local provider/inference path. The UI/runtime should show
   unavailable or fallback state visibly; it must not silently claim a normal local-agent run.

## Validation Matrix

| Behavior | Automated coverage | Manual/Computer Use coverage | Proof limit |
| --- | --- | --- | --- |
| Coop bootstrap creates memory charter | `flows-coverage.test.ts` | Create coop, inspect Nest charter | Does not prove copy quality for every purpose |
| Member charter edits persist | `flows-coverage.test.ts`, `sync-artifacts.test.ts`, `NestSourcesSection.test.tsx`, `AgentMemorySection.test.tsx` | Edit charter, reopen coop detail | Browser persistence still needs manual profile check |
| Source add/remove/toggle metadata round-trips | `source-registry.test.ts`, `source-sync.test.ts`, `knowledge-source-handlers.test.ts` | Add/toggle/remove source in Nest | Exact identifier normalization remains out of scope |
| Source refresh persists structured content | `knowledge-source-content.test.ts`, `knowledge-source-handlers.test.ts` | Refresh source and inspect freshness/entity count | Live adapter network quality is not proven by unit tests |
| Source-content observations reference persisted content IDs | `agent-observation-emitters.test.ts`, `knowledge-source-handlers.test.ts` | Inspect observation/agent dashboard after refresh | Observation scheduling is still runtime-environment dependent |
| Entity extraction writes observed graph context | `graph-persistence.test.ts`, `entity-extraction-quality.test.ts` | Trigger source-content-ready cycle and inspect graph health | Heuristic extraction quality is bounded by fixtures |
| Prompt context includes memory, graph, and precedents | `runner-skills-prompt.test.ts`, `reasoning-precedent.test.ts` | Observe agent cycle trace/prompt summary surfaces | Raw prompt body must remain local and is not shared for QA |
| Draft provenance fields survive output handling | `agent-output-handlers.test.ts`, `DraftCardProvenance.test.tsx` | Inspect Chickens/Roost draft badges | UI only shows summarized provenance, not raw source bodies |
| Approval strengthens traces and creates validated insights | `compound-loop.test.ts`, `review-handlers.test.ts` | Publish draft, inspect decision history | Shared validated insight projection is summary-level only |
| Rejection weakens local trace without shared truth | `compound-loop.test.ts`, `review-handlers.test.ts` | Demote/reject draft and inspect history | Does not automate every rejection UI entry point |
| Shared state excludes raw private material | `sync-artifacts.test.ts`, `knowledge-source-content.test.ts`, `source-sync.test.ts` | Inspect Yjs-safe state and Dexie redacted rows | Browser storage inspection remains manual |
| Adapter failure continues refresh | `knowledge-source-handlers.test.ts` | Refresh mixed failing/success source set | Unit test uses injected failure, not network chaos |
| Stale/removed source marks graph context stale | `source-registry.test.ts`, `knowledge-sandbox-integration.test.ts` | Remove source and inspect Roost/Nest labels | Large graph timing remains unproven |
| Provider unavailable/fallback is visible | `agent-runner.test.ts`, `agent-models.test.ts`, `operator-console.test.tsx` via broader gates | Disable local provider and inspect UI/fallback copy | Not included in `test:unit:memory-loop` to keep scope focused |

## Reporting Template

Record:

- Commands run and pass/fail status.
- Browser/Computer Use path tested, including app URL and WXT Chromium profile.
- Any unrelated failing tests with exact file/test names.
- Whether raw source body, raw capture, raw prompt, or unconfirmed graph fact appeared in shared
  state. Any appearance is a blocker.
- Remaining manual-only checks.
