# Coop WebMCP Strategy

Status: strategy only. Do not ship runtime WebMCP tools in v1.

## Candidate Visible Tools

- Docs: summarize public docs pages and navigate visible docs headings.
- Receiver PWA: explain visible pairing, sync status, and review states without reading private local stores.
- Extension UI: describe visible Popup, Chickens, Coops, Roost, and Nest controls when the user is actively viewing that surface.
- Public demo flows: guide normal visible controls for capture, review, and publish preparation without taking the action for the user.

## Forbidden Tools

- Reading Dexie, Yjs documents, browser-local private data, hidden extension state, background worker internals, or sync payloads.
- Signing, publishing, archiving, session-permission changes, onchain writes, Safe actions, or Filecoin uploads.
- Operator console changes, policy/permit execution, stealth/privacy actions, or identity changes.
- Hidden background actions, destructive operations, or cross-origin data extraction.

## Proof Before Runtime

- `bun run agentic:check` is stable and the selected app/extension/browser proof path passes.
- `bun run test:e2e:agentic-browser-report` writes app, Receiver PWA, Popup, and Sidepanel screenshots, accessibility summaries, console/page error status, reduced-motion status, overflow checks, and WebMCP discovery to `output/playwright/agentic-browser-proof/`.
- Runtime proposals demonstrate visible affordances, user confirmations, and local-first privacy boundaries.
- Reduced-motion and keyboard proof covers the same flows that WebMCP would expose.
