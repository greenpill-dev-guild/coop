# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
bun install                  # Install dependencies
bun dev                      # Start app + extension (concurrent)
bun dev:app                  # Start app only
bun dev:extension            # Start extension only (WXT dev + Chromium)
bun dev:api                  # Start API server (signaling + routes)
cd packages/app && bun run build        # Build app only
cd packages/extension && bun run build  # Build extension only
bun format && bun lint       # Format (Biome) and lint workspace
bun run test                 # Run all unit tests (vitest)
bun run test:e2e             # Run all Playwright E2E tests
bun build                    # Build everything (shared → app → extension)
bun run validate smoke       # Quick confidence run
bun run validate core-loop   # Main extension workflow validation
bun run validate full        # Full local pass before demos or bigger merges
bun run validate list        # List all available validation suites
bun run validate:store-readiness        # Chrome Web Store readiness gate
bun run validate:production-readiness   # Mock-first release readiness gate
bun run validate:production-live-readiness # Opt-in live rails gate
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

Docs note: the repo pins Node 22 in `.mise.toml`. If `node -v` still resolves an older version in
your shell, activate `mise` before running `bun run docs:dev` or `bun run docs:build`.

Per-package: check each package.json for available scripts.

## Architecture

Coop captures scattered knowledge (browser tabs, audio, photos, files, links), refines it into clear opportunities via an in-browser AI agent, and gives groups a shared space to act on what matters. Core capture, review, and local analysis stay in the browser; the repo also includes a minimal signaling/API layer for peer discovery and optional Yjs document sync. Bun monorepo.

### Product Loop
1. **Capture**: Browser tabs (extension) + audio, photos, files, links (companion PWA)
2. **Refine**: In-browser agent with 16-skill pipeline (WebGPU/WASM, no cloud)
3. **Review**: Members review candidates and drafts in the popup and Chickens before anything becomes shared
4. **Share**: Publish to a coop (Safe multisig on Arbitrum, local-first sync via Yjs with y-webrtc peers and y-websocket document sync, archived to Filecoin via Storacha when requested)

### Extension Surface Map
- `Popup`: quick capture and quick review
- `Chickens`: candidates, drafts, and publish prep
- `Coops`: shared coop state, archive, and proof
- `Roost`: Green Goods member workspace
- `Nest`: members, operator controls, and settings

### Key Principles
1. **Browser-First**: Extension is the primary product surface
2. **Local-First**: All data stays local until explicit publish/sync
3. **Passkey-First**: No wallet-extension-first UX; passkey identity
4. **Offline Capable**: Works without internet, syncs when connected
5. **Single Environment**: All packages share root `.env.local` (never create package-specific .env)

### Packages & Build Order
1. **shared** (`@coop/shared`) → Schemas, flows, sync contracts, all domain modules
2. **app** (`@coop/app`) → Landing page + receiver PWA shell
3. **extension** (`@coop/extension`) → MV3 browser extension (popup, sidepanel, background worker)
4. **api** (`@coop/api`) → Hono + Bun API server (Fly.io deployed)

### Shared Modules
- `agent`: Agent harness, skills, observation triggers, inference cascade, cross-session memory persistence
- `app`: Shared app-shell helpers
- `archive`: Storacha/Filecoin upload and lifecycle
- `auth`: Passkey-first identity + onchain auth
- `blob`: Binary relay for media and file transport
- `coop`: Core flow board, review, publish logic, and sync wiring
- `erc8004`: ERC-8004 on-chain agent registry integration
- `fvm`: Filecoin VM registry support
- `greengoods`: Green Goods garden maintenance, member work submission, operator approvals, and Hypercert packaging
- `member-account`: Member smart-account provisioning and execution
- `onchain`: Safe creation, ERC-4337, contract interactions, provider factory, signatures
- `operator`: Anchor/trusted-node runtime behavior
- `policy`: Action approval workflows, typed action bundles
- `permit`: Execution permits with replay protection
- `privacy`: Semaphore ZK membership proofs + anonymous publishing
- `receiver`: PWA receiver and cross-device sync
- `session`: Scoped execution permissions, time-bounded capabilities
- `stealth`: ERC-5564 stealth addresses (secp256k1)
- `storage`: Dexie + Yjs local persistence
- `transcribe`: Audio transcription and loader capability detection

## Key Patterns

**Module Boundary**: Shared modules in `@coop/shared`. Extension/app have views and runtime only.
```typescript
import { createCoop, joinCoop } from '@coop/shared'; // correct
```

**Barrel Imports**: Always `import { x } from "@coop/shared"`, never deep paths.

**Onchain Integration**: Safe + ERC-4337 + passkey auth. Chain set by `VITE_COOP_CHAIN` env var.
- Default: `sepolia` (test/dev)
- Production: `arbitrum` (Arbitrum One)
- Modes: `VITE_COOP_ONCHAIN_MODE` (mock | live), `VITE_COOP_ARCHIVE_MODE` (mock | live)

**Local Persistence**: Dexie for structured data, Yjs for CRDT sync, y-webrtc for direct peer transport, and y-websocket for server-assisted document sync.

**Error Handling**: Never swallow errors. Surface failures to the user.

**Vite Build Rules**:
- App config: `packages/app/vite.config.ts`, Extension config: `packages/extension/wxt.config.ts`
- All env vars require `VITE_` prefix for frontend access (`import.meta.env.VITE_*`)
- Env vars are baked at build time — rebuild after `.env.local` changes
- Preserve React Compiler and extension build config unless explicitly asked to change
- Never introduce package-level `.env` files or overlapping resolve aliases

**Dependency Rules**:
- Internal deps use `workspace:*` (never `workspace:^`)
- `bun.lock` is generated — never hand-edit it; regenerate with `bun install`
- Pin exact versions: viem, permissionless, react, dexie, yjs (breaking changes between minors)
- Use ranges for dev deps: vitest `^`, typescript `~`, @types/* `^`
- Install in the correct package, never root for package-specific needs

**Brand Metaphors**: Tabs = "Loose Chickens", the human review step is still called the "Roost" in product language, the current sidepanel `Roost` tab is the Green Goods member workspace, the shared feed = "Coop Feed", creating a coop = "Launching the Coop", success sound = "Rooster Call".

**Build and Verify**: After making changes, choose the appropriate verification tier and verify the result before reporting the task is done. Never tell the user a change is ready without verifying first. UI/CSS changes are invisible until the Vite build runs and the extension or app is reloaded.

**Build Scope**: Default to the smallest build that matches the change. Use `cd packages/extension && bun run build` for extension-only work and `cd packages/app && bun run build` for app-only work. Reserve root `bun build` for shared exports, shared styles/tokens, other cross-package changes, and pre-commit verification.

**Verification Tiers**: Not every change needs a full build. Choose the lightest tier that covers your change:

| Tier | Command | When to use | ~Time |
|------|---------|-------------|-------|
| **typecheck** | `bun run validate typecheck` | Single-package changes, no shared export changes | ~10s |
| **quick** | `bun run validate quick` | Typecheck + lint, good for formatting/type fixes | ~15s |
| **smoke** | `bun run validate smoke` | Cross-package changes, shared module edits | ~1m |
| **build** | `bun build` | CSS token changes, new shared exports, pre-commit | ~45s |
| **core-loop** | `bun run validate core-loop` | UI workflow changes needing E2E confirmation | ~5m |

Use `typecheck` or `quick` during iteration. Use `smoke` or higher before committing. Full `bun build` is required when: changing `@coop/shared` exports consumed by downstream packages, modifying CSS tokens in `shared/src/styles/`, or as part of pre-commit validation.

**UI Component Reuse**: Before creating new UI elements, check `packages/extension/src/views/shared/` for existing components and `packages/extension/src/global.css` for existing CSS classes. Reusable patterns already available:

- **Tooltip** — `shared/Tooltip.tsx` (position-aware, portal-rendered)
- **NotificationBanner** — `shared/NotificationBanner.tsx`
- **Theme toggle** — `Popup/PopupThemePicker.tsx` (used by both Popup and Sidepanel)
- **Icon buttons** — `.popup-icon-button` class in `global.css`
- **Subheader pills** — `.popup-subheader__tag` class in `global.css`
- **Cards** — `.panel-card`, `.draft-card`, `.artifact-card` in `global.css`
- **Badges** — `.badge`, `.state-pill` in `global.css`
- **Filter popover** — `.filter-popover` classes in `global.css`
- **Skeleton loaders** — `.skeleton`, `.skeleton-card`, `.skeleton-text` in `global.css`
- **Design tokens** — `shared/src/styles/tokens.css` (palette, spacing, radii, shadows, typography)

Do not duplicate these. Import or apply existing classes.

**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel. Work directly for single-file edits or tasks needing fewer than 10 tool calls. When spawning 2+ implementation agents in parallel, use `isolation: worktree` to prevent file conflicts. Read-only agents (code-reviewer, oracle, triage) don't need isolation.

## Infrastructure URLs

| URL | Points to | Notes |
|-----|-----------|-------|
| `wss://api.coop.town` | Fly.io production signaling | Always available (auto-start on request) |
| `wss://api.coop.town/yws` | Fly.io Yjs document sync | WebSocket fallback for peer sync |
| `https://coop.town` | Vercel PWA (landing + receiver) | Proxied through Cloudflare |
| `https://docs.coop.town` | Vercel docs | Proxied through Cloudflare |
| `wss://dev-api.coop.town` | Cloudflare tunnel → localhost:4444 | Only up during `bun dev` |
| `https://local.coop.town` | Cloudflare tunnel → localhost:3001 | Only up during `bun dev` |

## Environment

Single `.env.local` at root (never create package-specific .env). Env vars are baked into bundles at build time by Vite — rebuild after changes.

`.env.local` vars (essential defaults):
- `VITE_COOP_CHAIN`: Target chain (`sepolia` or `arbitrum`)
- `VITE_COOP_ONCHAIN_MODE`: `mock` (default) or `live`
- `VITE_COOP_ARCHIVE_MODE`: `mock` (default) or `live`
- `VITE_COOP_SESSION_MODE`: `mock`, `live`, or `off` (default)
- `VITE_COOP_SIGNALING_URLS`: Comma-separated signaling URLs (default: `wss://api.coop.town`)
- `VITE_COOP_RECEIVER_APP_URL`: Receiver PWA URL (default: `http://127.0.0.1:3001`)

Full reference: `docs/builder/environment.md` (30+ vars covering TURN, Pimlico, FVM, Green Goods, trusted-node archive, tunnels)

`bun dev` automatically sets `VITE_COOP_SIGNALING_URLS` and `VITE_COOP_RECEIVER_APP_URL` for the extension build. The extension gets both local and production signaling URLs for fallback.

## Validation Suites

Named suites via `scripts/validate.ts`:
- `typecheck`: Fast type-check only (~10s, no build)
- `quick`: Typecheck + lint (~15s)
- `smoke`: Unit tests + workspace build
- `core-loop`: Unit tests, build, two-profile extension flow
- `flow-board`: Board/archive unit tests + Playwright checks
- `receiver-slice`: App shell checks + pair/sync into extension
- `receiver-hardening`: Receiver sync with sidepanel closed
- `arbitrum-safe-live`: Live Safe probe (needs API keys)
- `full`: Lint, unit, build, all E2E suites

## Scope Discipline
- When instructions say "output in chat" or "just tell me", do NOT edit files
- For destructive changes: list what will be REMOVED and ADDED, then wait for confirmation
- Never replace content that was asked to be added as new
- When unsure about scope, ask

### Session Scope Lock

When the user asks to **explore**, **audit**, **plan**, or **investigate** — the session is **read-only**:
- Do NOT edit, write, or delete any code files
- Produce analysis, findings, or plans as chat output or markdown reports only
- If findings require fixes, list them and let the user decide when to implement
- If an agent drifts into making code changes during a read-only session, stop it immediately

Implementation only begins when the user explicitly says to **implement**, **fix**, **apply**, or **execute**.

### Post-Agent Regression Review

After completing parallel sub-agent runs that modify code, a **regression review is mandatory** before committing:

1. **Scope check**: For each file changed, verify it was in the agent's assigned scope — flag any out-of-scope modifications
2. **Conflict check**: Flag any file modified by more than one agent — these need manual review
3. **Build gate**: Run `bun run validate quick` (minimum) or `smoke` for cross-package changes
4. **Test gate**: Run `bun run test` and confirm no regressions vs. the pre-agent baseline
5. **Summary**: List all changes with a before/after test count before committing

Never commit agent outputs without completing this review. If regressions are found, fix them before reporting done.

## Git Workflow

**Branches**: `type/description` (e.g., `feature/receiver-pwa`, `fix/sync-race`)

### Planning OS

`.plans/` is the single live planning space for active feature execution.

- New feature work goes in `.plans/features/<feature-slug>/`
- `docs/reference/` remains the place for ratified, long-lived reference docs
- Do not create new active planning files in repo root

Canonical feature-pack layout:

```text
.plans/features/<feature-slug>/
  spec.md
  context.md
  lanes/
    ui.claude.todo.md
    state.codex.todo.md
    api.codex.todo.md
    contracts.codex.todo.md
  qa/
    qa-codex.todo.md
    qa-claude.todo.md
  eval/
    implementation-notes.md
    qa-report.md
```

Lane ownership:

- Claude: `ui` and QA pass 2
- Codex: `state`, `api`, `contracts`, and QA pass 1
- Both: `docs` via dedicated docs-drift lanes

Sequential QA handoff branches:

- `handoff/qa-codex/<feature-slug>`
- `handoff/qa-claude/<feature-slug>`

Automation entrypoints:

- `bun run plans validate`
- `bun run plans scaffold <feature-slug> --title "<Feature Title>"`
- `bun run plans queue --agent claude --lane ui`
- `bun run plans queue --agent codex`
- `bun run plans queue --agent claude --lane docs`
- `bun run plans queue --agent codex --lane docs`
- `bun run plans queue --agent claude --lane qa --handoff-ready`
- `bun run plans queue --agent codex --lane qa --handoff-ready`

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: shared, extension, app, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`

## Context Hygiene

- `/clear` between unrelated tasks — context pollution is the #1 cause of degraded output
- After 2 failed corrections, `/clear` and start fresh with a better prompt
- `/btw` for side questions that shouldn't enter conversation history
- Scope investigations: use subagents for broad exploration, keep main context focused

**On compaction, preserve**: current task, modified files list, test state (passing/failing), active verification tier, any blockers. The `PreCompact` hook auto-saves `session-state.md` but verify it captured your state.

## Session Continuity

Before context compaction or ending a long session, write a `session-state.md` in the working directory:

```markdown
## Session State
- **Current task**: [what you're working on]
- **Progress**: [what's done, what's in progress]
- **Files modified**: [list of changed files]
- **Tests**: [passing/failing/not yet written]
- **Next steps**: [immediate next actions]
- **Blocked by**: [blockers, if any]
```

## Cleanup

If you create temporary files, scripts, or helpers during iteration, remove them before reporting task completion.
