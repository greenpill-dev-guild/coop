# Chrome Platform Tracker

Last refreshed: 2026-05-24

Guidance sources: `modern-web-guidance@latest`, Chrome same-document View Transitions, Chrome WebMCP, Lighthouse Registered WebMCP tools, Chrome soft-navigation measurement, Chrome DevTools Performance reference, and Chrome DevTools MCP.

| Feature | Current adoption | Candidate surface | Risk | Proof command | Status |
| --- | --- | --- | --- | --- | --- |
| `/llms.txt` and public docs context | Docs publish `llms.txt`; agentic browser proof checks discovery status. | Public docs, app shell, Receiver PWA, Popup, and Sidepanel proof reports. | Agent context must not imply access to hidden local data or extension state. | `bun run agentic:browser-proof` | ship |
| Semantic, native, accessible DOM | AGENTS/CLAUDE require Baseline Widely Available, DesignMD, accessibility summaries, reduced motion, and rendered proof. | App, Receiver PWA, Popup, Sidepanel, and docs. | Extension and PWA controls can become visually clear but agent/keyboard ambiguous. | `bun run agentic:check` | ship |
| Same-document View Transitions | App route changes already use `document.startViewTransition` with reduced-motion CSS coverage. | Receiver/app navigation where route changes are visible and value is clear. | Transitions must never mask stale state, review queues, or permission changes. | `bun run validate:quick` plus focused visual proof when touched. | ship |
| WebMCP runtime tools | Strategy and discovery probes only; roadmap mentions are not approval to ship runtime tools. | Future visible Receiver or docs tools after consent design and policy tests. | Hidden extension state, Dexie/Yjs, session permissions, signing, publish, sync, or background-worker access would violate local-first boundaries. | Chrome DevTools MCP `list_webmcp_tools` must prove no hidden extension/background tools. | watch |
| Chrome Prompt API, Gemma, WebLLM, Transformers.js | Local-first provider work exists as planning/runtime boundaries, not a universal browser API dependency. | Provider proof and next-gen model readiness lanes. | Browser AI APIs and local models can blur cloud/local, extension permission, and fallback expectations. | Keep provider evals in existing validation lanes; document unsupported/fallback modes. | prototype |
| Chrome DevTools MCP proof | Agentic browser proof records screenshots, accessibility summaries, console/page errors, reduced motion, overflow, and WebMCP discovery. | Extension-safe debugging and proof of Popup/Sidepanel without exposing background state. | Real-profile debugging can expose private tabs, cookies, extension storage, or unpublished drafts. | `bun run agentic:browser-proof`; use isolated/non-default Chrome profiles for MCP proof. | ship |
| Core Web Vitals and soft navigations | No repo-wide CWV RUM lane is documented for SPA route segmentation. | Receiver/app route transitions and docs pages. | Soft-navigation measurement is still under development; do not confuse local traces with CrUX. | Plan first: capture LCP, INP, CLS, route label, `navigationType`, and interaction context. | watch |
| HTML-in-Canvas, Declarative Partial Updates, `streamHTML` | No production dependency. | Research backlog only. | Experimental APIs can bypass accessible DOM and extension review boundaries. | Spike requires accessibility-tree and fallback proof before implementation. | watch |

## Adoption Notes

- Keep model/provider work explicit about local-first behavior, fallback mode, and whether a browser API is behind a flag or unavailable.
- WebMCP remains frozen at strategy/proof level until the user explicitly approves runtime `navigator.modelContext.registerTool`, `toolname`, or `tooldescription` work.
- DevTools-for-Agents proof must not inspect hidden extension storage or background-worker state unless the user asks for a dedicated debugging session.

## Operational Follow-Up

- Repo-native task surface: `.plans/features/modern-css-web-ui-primitives/spec.md` under `Chrome Platform Follow-Up Tasks`.
- Next proof task: define app/Receiver CWV and soft-navigation evidence using existing `web-vitals`, Playwright, and `agentic:browser-proof` paths; run isolated DevTools MCP only against public or extension-safe surfaces, never a personal profile.
