# Coop WebMCP Strategy

Status: strategy only. Do not ship runtime WebMCP tools in v1.

## Candidate Visible Tools

- Public docs: summarize visible docs, architecture pages, and public readiness notes.
- Receiver PWA and app: describe visible local-first UI state, review queues, empty states, and navigation options without reading hidden storage.
- Extension UI: describe visible Popup and Sidepanel controls for local development proof, not hidden background state.
- Local diagnostics: surface browser-proof report metadata, screenshots, accessibility summaries, console/page errors, reduced-motion state, and WebMCP discovery status.

## Forbidden Tools

- Private local extension data, Dexie/Yjs contents, hidden extension state, session permissions, signing keys, unpublished drafts, secrets, or operator-only workflows.
- Capture, archive, publish, signing, sync mutation, grant/session-key, onchain, destructive, or background-only actions.
- Any tool that bypasses human review, local-first consent, extension permission boundaries, or the normal visible UI.

## User Confirmation And Local-First Safety

- Runtime tools must be visible in the current page or extension surface and scoped to the selected UI state.
- Any action that changes local data, shares data, publishes work, syncs rooms, signs messages, or grants permissions requires explicit user confirmation and deterministic policy tests before WebMCP exposure.
- Tool output must be limited to visible DOM/accessibility-tree state unless the user explicitly approves a separate authenticated debugging session.

## Proof Before Runtime

- `bun run agentic:check`, `bun run agentic:browser-proof`, and the relevant `bun run test:visual` / `bun run agentic:verify` lane must pass or have documented proof limits.
- Browser proof must cover app, Receiver PWA, Popup, and Sidepanel surfaces with screenshots, accessibility summaries, console/page errors, overflow, reduced-motion state, and WebMCP discovery.
- Chrome DevTools MCP or Puppeteer WebMCP must prove only expected visible tools are discoverable and forbidden extension/background capabilities are absent.
- Tool evals must include wrong-tool, wrong-order, wrong-argument, and stale-local-state failure cases before any runtime implementation.
