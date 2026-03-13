# Coop Agentic Development Guide

How to use the Claude Code system configured for this repo.

---

## Quick Start

When you open Claude Code in the coop repo, you'll see:

```
Coop Claude Code
  /plan /debug /review /audit /meeting-notes
  Agents: oracle | cracked-coder | code-reviewer | migration | triage
```

These are your entry points. Type a slash command or describe your task — Claude will route to the right skill automatically.

---

## Commands

Slash commands are the primary way to start structured workflows.

| Command | What it does | Example |
|---------|-------------|---------|
| `/plan` | Creates a step-by-step implementation plan | `/plan` add receiver pairing flow |
| `/debug` | Systematic root cause investigation | `/debug` sync fails when sidepanel is closed |
| `/review` | 6-pass code review (read-only by default) | `/review` |
| `/audit` | Dead code detection + architectural health | `/audit` |
| `/meeting-notes` | Extract GitHub issues from a meeting transcript | Paste a transcript, then `/meeting-notes` |

### Command Modes

Commands have modes that change their behavior:

```
/review                              → report only (default)
/review --mode apply_fixes           → review + auto-fix findings
/review --mode verify_only           → cross-package verification

/debug                               → investigation only (default)
/debug --mode tdd_bugfix             → reproduce → fix → verify loop
/debug --mode incident_hotfix        → P0/P1 emergency response
```

---

## Agents

Agents are specialized Claude instances for sustained, complex tasks. They run as subprocesses with their own context.

| Agent | Model | When to use |
|-------|-------|-------------|
| **oracle** | opus | Research questions needing 3+ sources. Root cause analysis. Architectural decisions. |
| **cracked-coder** | opus | Multi-file implementation with TDD. Features, bugfixes, optimization. |
| **code-reviewer** | opus | PR reviews. Read-only — never edits files. Produces APPROVE or REQUEST_CHANGES. |
| **migration** | opus | Breaking changes across shared → app → extension. Dependency upgrades. |
| **triage** | haiku | Fast issue classification (P0-P4). Routes to the right agent or command. |

### When NOT to use agents

- Simple changes (< 50 lines): Just ask Claude directly
- Research-only: oracle alone is enough
- Review-only: code-reviewer alone is enough
- Single-file edits: Direct is faster than spawning

### Agent handoff chain

For complex work, agents chain naturally:

```
triage → oracle → cracked-coder → code-reviewer
  ↓         ↓           ↓              ↓
classify  research   implement      review
```

Each agent passes a concise brief to the next. Triage keeps it to 5 lines, oracle to 20, reviewer to 15.

---

## Skills

Skills are domain knowledge that Claude loads when relevant. Most activate automatically based on keywords — you don't need to invoke them explicitly.

### Core Domain Skills

| Skill | Activates when you say | What it knows |
|-------|----------------------|---------------|
| **react** | "component", "hooks", "state" | React 19 patterns, composition, re-render optimization |
| **web3** | "Safe", "passkey", "ERC-4337", "onchain" | viem, Safe SDK, permissionless, passkey auth, account abstraction |
| **data-layer** | "Dexie", "Yjs", "sync", "offline", "local-first" | Dexie persistence, Yjs CRDTs, y-webrtc, draft lifecycle, storage |
| **testing** | "test", "TDD", "vitest", "playwright" | Vitest unit tests, Playwright E2E, mock strategies, TDD workflow |
| **security** | "vulnerability", "XSS", "key exposure" | Extension security, passkey/WebAuthn, CRDT integrity, CSP |
| **error-handling-patterns** | "error handling", "try/catch" | Error boundaries, retry patterns, user-facing messages |

### Build & Tooling Skills

| Skill | Activates when you say | What it knows |
|-------|----------------------|---------------|
| **vite** | "build config", "bundle", "env vars" | Vite config, MV3 extension builds, environment variables |
| **biome** | "format", "lint", "import sorting" | Biome formatting, CI integration, migration from Prettier |
| **git-workflow** | "branch", "commit", "merge" | Conventional commits, branching strategy, conflict resolution |
| **ci-cd** | "CI", "GitHub Actions", "pipeline" | Workflow config, build matrix, caching, PR checks |
| **dependency-management** | "lockfile", "upgrade", "bun install" | Workspace protocol, phantom dependencies, audit/update |
| **migration** | "breaking change", "upgrade" | Cross-package migration, Dexie schema changes, dependency order |

### Design Skills

| Skill | Activates when you say | What it knows |
|-------|----------------------|---------------|
| **frontend-design** | "build page", "design UI" | Production-grade interfaces, distinctive visual design |
| **tailwindcss** | "TailwindCSS", "dark mode", "tokens" | TailwindCSS v4, @theme directive, design tokens |
| **ui-compliance** | "accessibility", "a11y", "WCAG" | WCAG 2.1 AA, form validation, responsive layouts |

### Structural Skills

| Skill | Activates when you say | What it knows |
|-------|----------------------|---------------|
| **architecture** | "refactor", "module boundaries" | Clean Architecture, entropy reduction, module design |
| **performance** | "bundle size", "memory leak" | Bundle analysis, Lighthouse, React Profiler |

---

## Hooks (Automated Guardrails)

Hooks run automatically — you don't invoke them. They enforce project rules:

| When | What it checks | Effect |
|------|---------------|--------|
| Before any edit/write | Package-level `.env` files | **Blocks** — single root `.env` only |
| Before any bash | `bun test` (without `run`) | **Blocks** — must use `bun run test` |
| Before any bash | Force push to main/master | **Blocks** — never allowed |
| Before any bash | Production deployment | **Warns** — requires confirmation |
| Before any git commit | Lint check | **Warns** — runs `bun lint` |
| After any edit/write | Biome format | **Auto-formats** the edited file |
| On context compaction | Post-compaction reminders | Restores key rules after memory trim |
| On notification | macOS alert | Pings when Claude needs attention |

---

## Plugins

Three official Claude plugins are enabled:

| Plugin | What it does |
|--------|-------------|
| **frontend-design** | UI/UX guidance when building interfaces |
| **code-simplifier** | Suggests refactoring opportunities after edits |
| **typescript-lsp** | TypeScript language server for type-aware editing |

---

## Context Files

When working deeply in a package, Claude loads additional context:

| Working in | Context loaded | Content |
|-----------|---------------|---------|
| `packages/shared/` | `.claude/context/shared.md` | Module map, Dexie schema, Yjs patterns, Safe integration |
| `packages/extension/` | `.claude/context/extension.md` | MV3 architecture, runtime messaging, service worker |
| `packages/app/` | `.claude/context/app.md` | Landing page, React Flow board, receiver flows |
| Product questions | `.claude/context/product.md` | Vision, personas, brand direction, demo criteria |

---

## Skill Bundles

Bundles group skills for common workflows. The system uses these to load the right context:

| Bundle | Skills loaded | When |
|--------|-------------|------|
| **extension-change** | react, tailwindcss, frontend-design, testing, ui-compliance | Extension UI work |
| **shared-module-change** | react, web3, data-layer, error-handling-patterns, testing | Shared module changes |
| **onchain-change** | web3, security, testing | Safe/passkey/chain work |
| **app-change** | react, tailwindcss, frontend-design, testing, ui-compliance | App/landing page work |
| **cross-package-change** | review, cross-package-verify, testing | Multi-package verification |
| **incident-hotfix** | debug, tdd-bugfix, testing | Emergency response |

---

## Coverage Matrix

Which skills apply to which packages:

| Skill | shared | app | extension |
|-------|:------:|:---:|:---------:|
| react | x | x | x |
| web3 | x | x | x |
| data-layer | x | x | x |
| testing | x | x | x |
| security | x | x | x |
| error-handling-patterns | x | x | x |
| architecture | x | x | x |
| performance | x | x | x |
| frontend-design | | x | x |
| tailwindcss | | x | x |
| ui-compliance | | x | x |
| vite | | x | x |
| migration | x | x | x |
| biome | x | x | x |

---

## Conventions Enforced

| Convention | Enforced by |
|------------|-------------|
| Shared modules in `@coop/shared` only | CLAUDE.md |
| Single root `.env` only | Hook (blocks) |
| `bun run test` not `bun test` | Hook (blocks) |
| No force push to main/master | Hook (blocks) |
| Barrel imports only (`@coop/shared`) | CLAUDE.md |
| Local-first data patterns | data-layer skill |
| Passkey-first auth | web3 skill |
| Conventional commits with scope | git-workflow skill |
| Biome format on save | Hook (auto) |
