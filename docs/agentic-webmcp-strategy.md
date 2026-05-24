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

## Chrome DevTools MCP Proof Profile

- Prefer the repo browser lane first: screenshots/DOM, accessibility summaries, console/page errors, overflow, reduced-motion state, and WebMCP discovery across app, Receiver PWA, Popup, and Sidepanel.
- Use Chrome DevTools MCP only as an additional proof pass for browser-runtime issues, extension-safe DevTools inspection, network/performance traces, or WebMCP discovery checks that the repo lane cannot explain.
- Run MCP proof from an isolated or non-default Chrome profile. Do not connect agent tooling to a normal profile when the inspected surface can expose hidden extension state, cookies, local storage, Dexie/Yjs data, private tabs, unpublished drafts, or permissions.
- The proof bundle for any runtime candidate must include: surface URL or extension surface, viewport, screenshot, DOM or accessibility snapshot, console/page error summary, network/performance notes when relevant, `/llms.txt` result for web surfaces, reduced-motion result, and `list_webmcp_tools` output.

## Proof Before Runtime

- `bun run agentic:check`, `bun run agentic:browser-proof`, and the relevant `bun run test:visual` / `bun run agentic:verify` lane must pass or have documented proof limits.
- Browser proof must cover app, Receiver PWA, Popup, and Sidepanel surfaces with screenshots, accessibility summaries, console/page errors, overflow, reduced-motion state, and WebMCP discovery.
- Chrome DevTools MCP or Puppeteer WebMCP must prove only expected visible tools are discoverable and forbidden extension/background capabilities are absent.
- Tool evals must include wrong-tool, wrong-order, wrong-argument, and stale-local-state failure cases before any runtime implementation.

## Runtime Approval Spec (Frozen)

Before any runtime implementation request, write an approval-ready spec that lists candidate visible tools, forbidden tools, confirmation rules, the local-first privacy boundary, input and output schema tests, wrong-tool and wrong-argument evals, stale-state evals, and the exact proof commands. This document is still strategy-only; do not add runtime `navigator.modelContext.registerTool`, `toolname`, or `tooldescription` without explicit user approval.
