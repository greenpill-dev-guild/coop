# AGENTS.md

Repository instructions for AI coding agents. Tool-specific config lives in `.claude/` (Claude Code) and `.codex/` (Codex). This file is the shared source of truth.

For full details, see [`CLAUDE.md`](./CLAUDE.md).

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
bun run build                # Build everything (shared -> app -> extension)
bun run validate smoke       # Quick confidence run
bun run validate core-loop   # Main extension workflow validation
bun run validate full        # Full local pass before demos or bigger merges
bun run validate list        # List all available validation suites
bun run validate:store-readiness        # Chrome Web Store readiness gate
bun run validate:production-readiness   # Mock-first release readiness gate
bun run validate:production-live-readiness # Opt-in live rails gate
```

**CRITICAL**: Always `bun run test`, never `bun test`. Bun's built-in runner ignores vitest config.

Docs note: the repo pins Node 22 in `.mise.toml`. If `node -v` still resolves an older version in
your shell, activate `mise` before running `bun run docs:dev` or `bun run docs:build`.

## Architecture

Coop captures scattered knowledge (browser tabs, audio, photos, files, links), refines it into clear opportunities via an in-browser AI agent, and gives groups a shared space to act on what matters. Core capture, review, and local analysis stay in the browser; the repo also includes a minimal signaling/API layer for peer discovery and optional Yjs document sync. Bun monorepo.

### Product Loop

1. **Capture**: Browser tabs (extension) + audio, photos, files, links (companion PWA)
2. **Refine**: In-browser agent with 16-skill pipeline (WebGPU/WASM, no cloud)
3. **Review**: Members review candidates and drafts in the popup and Chickens before anything becomes shared
4. **Share**: Publish to a coop (Safe multisig on Arbitrum, local-first sync via Yjs with y-webrtc peers and y-websocket document sync, archived to Filecoin via Storacha when requested)

### Extension Surface Map

- `Popup` -- quick capture and quick review
- `Chickens` -- candidates, drafts, and publish prep
- `Coops` -- shared coop state, archive, and proof
- `Roost` -- Green Goods member workspace
- `Nest` -- members, operator controls, and settings

### Key Principles

1. **Browser-First**: Extension is the primary product surface
2. **Local-First**: All data stays local until explicit publish/sync
3. **Passkey-First**: No wallet-extension-first UX; passkey identity
4. **Offline Capable**: Works without internet, syncs when connected
5. **Single Environment**: All packages share root `.env.local` (never create package-specific .env)

### Packages & Build Order

1. **shared** (`@coop/shared`) -- Schemas, flows, sync contracts, all domain modules
2. **app** (`@coop/app`) -- Landing page + receiver PWA shell
3. **extension** (`@coop/extension`) -- MV3 browser extension (popup, sidepanel, background worker)
4. **api** (`@coop/api`) -- Hono + Bun API server (Fly.io deployed)

### Shared Modules

`agent` (harness/skills/inference), `app` (shared shell logic), `archive` (Storacha/Filecoin), `auth` (passkey identity), `blob` (binary relay), `coop` (flow board/review/publish), `erc8004` (agent registry), `fvm` (Filecoin VM integration), `greengoods` (garden, member, and operator coordination), `member-account` (Kernel member accounts), `onchain` (Safe/ERC-4337), `operator` (trusted-node), `permit` (execution permits), `policy` (action approval), `privacy` (Semaphore ZK), `receiver` (PWA sync), `session` (scoped permissions), `stealth` (ERC-5564), `storage` (Dexie + Yjs), `transcribe` (audio transcription).

## Key Patterns

### Always Do

- Import from `@coop/shared` barrel only: `import { x } from '@coop/shared'`
- Internal deps use `workspace:*` (never `workspace:^`)
- All env vars require `VITE_` prefix for frontend access
- Env vars are baked at build time -- rebuild after `.env.local` changes
- Pin exact versions: viem, permissionless, react, dexie, yjs
- Use ranges for dev deps: vitest `^`, typescript `~`, @types/* `^`
- Surface all errors to the user -- never swallow errors
- Check existing components before creating new ones (see UI Component Reuse below)
- Read code before answering questions about it
- Prefer isolated package builds during iteration (`cd packages/extension && bun run build`, `cd packages/app && bun run build`) and only escalate to `bun run build` for cross-package verification
- Verify changes build before reporting done

### Never Do

- Create package-specific `.env` files (single root `.env.local` only)
- Use deep import paths (`@coop/shared/modules/auth/...`)
- Use `bun test` (always `bun run test`)
- Define domain logic in extension/app (put it in `@coop/shared`)
- Access Dexie directly from views (use runtime messages)
- Use `setInterval` in background worker (use `chrome.alarms`)
- Use `window` in service worker context
- Skip HMAC validation on receiver sync envelopes
- Introduce overlapping Vite resolve aliases

### Verification Tiers

Not every change needs a full build. Choose the lightest tier that covers your change:

| Tier | Command | When to use |
|------|---------|-------------|
| typecheck | `bun run validate typecheck` | Single-package, no shared export changes |
| quick | `bun run validate quick` | Typecheck + lint, formatting/type fixes |
| smoke | `bun run validate smoke` | Cross-package changes, shared module edits |
| build | `bun run build` | CSS tokens, new shared exports, pre-commit |
| core-loop | `bun run validate core-loop` | UI workflow changes needing E2E |

### Build Scope

- Default to the smallest build that matches the change.
- Extension-only changes: `cd packages/extension && bun run build`
- App-only changes: `cd packages/app && bun run build`
- Use root `bun run build` only when shared exports, shared styles/tokens, or other cross-package changes need downstream verification.

### UI Component Reuse

Before creating new UI elements, check `packages/extension/src/views/shared/` and `packages/extension/src/global.css`. Existing: Tooltip, NotificationBanner, ThemePicker, icon buttons (`.popup-icon-button`), cards (`.panel-card`, `.draft-card`), badges (`.badge`, `.state-pill`), skeleton loaders (`.skeleton`), design tokens (`shared/src/styles/tokens.css`).

### Onchain Integration

Safe + ERC-4337 + passkey auth. Chain set by `VITE_COOP_CHAIN` (default: `sepolia`, production: `arbitrum`). Modes: `VITE_COOP_ONCHAIN_MODE` (mock|live), `VITE_COOP_ARCHIVE_MODE` (mock|live).

### Local Persistence

Dexie for structured data, Yjs for CRDT sync, y-webrtc for direct peer transport, y-websocket for server-assisted document sync.

## Environment

Single `.env.local` at root. Essential vars:
- `VITE_COOP_CHAIN`: `sepolia` or `arbitrum`
- `VITE_COOP_ONCHAIN_MODE`: `mock` (default) or `live`
- `VITE_COOP_ARCHIVE_MODE`: `mock` (default) or `live`
- `VITE_COOP_SESSION_MODE`: `mock`, `live`, or `off` (default)
- `VITE_COOP_SIGNALING_URLS`: Comma-separated (default: `wss://api.coop.town`)
- `VITE_COOP_RECEIVER_APP_URL`: Receiver PWA URL (default: `http://127.0.0.1:3001`)

Full reference: `docs/builder/environment.md`

## Git Workflow

**Branches**: `type/description` (e.g., `feature/receiver-pwa`, `fix/sync-race`)

### Planning OS

`.plans/` is the single live planning space for active feature work.

- New feature execution work goes in `.plans/features/<feature-slug>/`
- Ratified, long-lived docs stay in `docs/reference/`
- Do not create new active plan files in repo root

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

- Claude: `ui` and `qa` pass 2
- Codex: `state`, `api`, `contracts`, and `qa` pass 1
- Both: `docs` via dedicated docs-drift lanes

QA handoff branches:

- `handoff/qa-codex/<feature-slug>` triggers the first QA pass
- `handoff/qa-claude/<feature-slug>` triggers the second QA pass

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

**Validation before committing**: `bun format && bun lint && bun run test && bun run build`

## Domain Knowledge

Read the relevant skill file before working in that area:

| Domain | Skill File |
|--------|-----------|
| Code review (6-pass protocol) | `.claude/skills/review/SKILL.md` |
| Testing (TDD, Vitest, Playwright) | `.claude/skills/testing/SKILL.md` |
| React (components, state, hooks) | `.claude/skills/react/SKILL.md` |
| Web3 (Safe, ERC-4337, passkeys) | `.claude/skills/web3/SKILL.md` |
| Security (XSS, keys, MV3 APIs) | `.claude/skills/security/SKILL.md` |
| Data layer (Dexie, Yjs, CRDTs) | `.claude/skills/data-layer/SKILL.md` |
| Error handling patterns | `.claude/skills/error-handling-patterns/SKILL.md` |
| UI/Accessibility (WCAG 2.1 AA) | `.claude/skills/ui-compliance/SKILL.md` |
| Architecture (Clean, Hexagonal, DDD) | `.claude/skills/architecture/SKILL.md` |
| Performance (bundle, profiling) | `.claude/skills/performance/SKILL.md` |
| Planning workflows | `.claude/skills/plan/SKILL.md` |
| Debugging (root cause analysis) | `.claude/skills/debug/SKILL.md` |
| Codebase audit (dead code, health) | `.claude/skills/audit/SKILL.md` |
| Commit organization | `.claude/skills/commit/SKILL.md` |

## Package Context

Detailed architecture documentation per package:

| Package | Context File |
|---------|-------------|
| Extension (MV3, surfaces, handlers) | `.claude/context/extension.md` |
| Shared (modules, boundaries) | `.claude/context/shared.md` |
| App (landing, receiver PWA) | `.claude/context/app.md` |
| Product (flows, journeys) | `.claude/context/product.md` |

## Package Rules

Constraints and conventions per domain:

| Domain | Rules File |
|--------|-----------|
| Tests | `.claude/rules/tests.md` |
| Extension (MV3) | `.claude/rules/extension.md` |
| Shared modules | `.claude/rules/shared.md` |
| Onchain | `.claude/rules/onchain.md` |
| Styles/tokens | `.claude/rules/styles.md` |
| Sync & storage | `.claude/rules/sync-and-storage.md` |
| Schemas | `.claude/rules/schemas.md` |

## Infrastructure

| URL | Purpose |
|-----|---------|
| `wss://api.coop.town` | Fly.io production signaling |
| `wss://api.coop.town/yws` | Fly.io Yjs document sync |
| `https://coop.town` | Vercel PWA (landing + receiver) |
| `https://docs.coop.town` | Vercel docs |
