# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
bun install                  # Install dependencies
bun dev                      # Start app + extension (concurrent)
bun dev:app                  # Start app only
bun dev:extension            # Start extension only (watch build)
bun dev:api                  # Start API server (signaling + routes)
bun format && bun lint       # Format (Biome) and lint workspace
bun run test                 # Run all unit tests (vitest)
bun run test:e2e             # Run all Playwright E2E tests
bun build                    # Build everything (shared → app → extension)
bun run validate smoke       # Quick confidence run
bun run validate core-loop   # Main extension workflow validation
bun run validate full        # Full local pass before demos or merges
bun run validate list        # List all available validation suites
```

> **`bun test` vs `bun run test`**: `bun test` uses bun's built-in runner (ignores vitest config). `bun run test` runs the package.json script (vitest with proper environment). Always use `bun run test`.

Per-package: check each package.json for available scripts.

## Architecture

Coop captures scattered knowledge (browser tabs, audio, photos, files, links), refines it into clear opportunities via an in-browser AI agent, and gives groups a shared space to act on what matters. Bun monorepo.

### Product Loop
1. **Capture**: Browser tabs (extension) + audio, photos, files, links (companion PWA)
2. **Refine**: In-browser agent with 14-skill pipeline (WebGPU/WASM, no cloud)
3. **Review**: Drafts land in the Roost for human triage
4. **Share**: Publish to a coop (Safe multisig on Arbitrum, P2P sync via Yjs + y-webrtc, archived to Filecoin via Storacha)

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
- `auth`: Passkey-first identity + onchain auth
- `coop`: Core flow board, review, and publish logic
- `storage`: Dexie + Yjs local persistence
- `archive`: Storacha/Filecoin upload and lifecycle
- `onchain`: Safe creation, ERC-4337, contract interactions, provider factory, signatures
- `receiver`: PWA receiver and cross-device sync
- `privacy`: Semaphore ZK membership proofs + anonymous publishing
- `stealth`: ERC-5564 stealth addresses (secp256k1)
- `agent`: Agent harness, skills, observation triggers, inference cascade, cross-session memory persistence
- `operator`: Anchor/trusted-node runtime behavior
- `policy`: Action approval workflows, typed action bundles
- `session`: Scoped execution permissions, time-bounded capabilities
- `permit`: Execution permits with replay protection
- `greengoods`: Green Goods garden bootstrap and sync
- `erc8004`: ERC-8004 on-chain agent registry integration
- `app`: App shell logic

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

**Local Persistence**: Dexie for structured data, Yjs for CRDT sync, y-webrtc for peer transport.

**Error Handling**: Never swallow errors. Surface failures to the user.

**Brand Metaphors**: Tabs = "Loose Chickens", review queue = "Roost", shared feed = "Coop Feed", creating a coop = "Launching the Coop", success sound = "Rooster Call".

**Investigate Before Answering**: Never speculate about code you have not opened. If referencing a specific file, you MUST read it before answering.

**Subagent Discipline**: Spawn teammates when tasks can run in parallel. Work directly for single-file edits or tasks needing fewer than 10 tool calls.

## Environment

Single `.env.local` at root (never create package-specific .env). `.env.local` vars:
- `VITE_COOP_CHAIN`: Target chain (`sepolia` or `arbitrum`)
- `VITE_COOP_ONCHAIN_MODE`: `mock` (default) or `live`
- `VITE_COOP_ARCHIVE_MODE`: `mock` (default) or `live`
- `VITE_PIMLICO_API_KEY`: For live Safe/4337 operations
- `VITE_STORACHA_ISSUER_URL`: For live archive delegation

## Validation Suites

Named suites via `scripts/validate.ts`:
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

## Git Workflow

**Branches**: `type/description` (e.g., `feature/receiver-pwa`, `fix/sync-race`)

**Commits**: Conventional Commits with scope: `type(scope): description`
- Types: feat, fix, refactor, chore, docs, test, perf, ci
- Scopes: shared, extension, app, claude

**Validation before committing**: `bun format && bun lint && bun run test && bun build`

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
