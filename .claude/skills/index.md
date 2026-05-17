# Coop Agentic Development Guide

How to use the Claude Code system configured for this repo.

---

## Quick Start

When you open Claude Code in the coop repo, you'll see:

```
Coop Claude Code
  /status /plan /debug /review /audit /monitor
  Agents: oracle | cracked-coder | code-reviewer | migration | triage
```

These are your entry points. Type a slash command or describe your task — Claude will route to the right skill automatically.

---

## Decision Tree

```text
What do you need?
│
├─ Start your day / lay of the land ──── /status
│
├─ Build or change something ──────────── /plan
│   ├─ UI / component work ────────────── react, ui-compliance, frontend-design
│   ├─ Shared module changes ──────────── react, web3, data-layer
│   ├─ Onchain / Safe / passkey ───────── web3, security
│   ├─ Sync / storage / offline ───────── data-layer
│   └─ Cross-package changes ──────────── /review --mode verify_only
│
├─ Fix a bug ──────────────────────────── /debug
│   ├─ Reproduce → fix → verify ───────── /debug --mode tdd_bugfix
│   └─ P0/P1 emergency ───────────────── /debug --mode incident_hotfix
│
├─ Review code ────────────────────────── /review
│   ├─ Report only (default) ──────────── /review
│   └─ Review + auto-fix ─────────────── /review --mode apply_fixes
│
├─ Check codebase health ──────────────── /audit
│   ├─ Dead code + anti-patterns ──────── /audit
│   ├─ Architecture analysis ─────────── /architecture
│   └─ Engineering principles ─────────── /principles
│
├─ Monitor quality ────────────────────── /monitor
│
└─ Multi-step complex task ────────────── Spawn an agent (see below)
```

---

## Commands

Slash commands are the primary way to start structured workflows.

| Command | What it does | Example |
|---------|-------------|---------|
| `/status` | Morning briefing — pipeline, health, journeys, focus | `/status` or `/status --quick` |
| `/plan` | Creates a step-by-step implementation plan | `/plan` add receiver pairing flow |
| `/debug` | Systematic root cause investigation | `/debug` sync fails when sidepanel is closed |
| `/review` | 6-pass code review (read-only by default) | `/review` |
| `/audit` | Dead code detection + architectural health | `/audit` |
| `/architecture` | Analyze structure, identify gaps, provide suggestions | `/architecture` or `/architecture shared` |
| `/principles` | SOLID, DRY, KISS, YAGNI, SOC, EDA, ADR, C4, ACID, BASE, CAP | `/principles` or `/principles shared` |
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

### Plan queue

Active feature execution lives in `.plans/features/<feature-slug>/`.

- Claude lane ownership: `ui`, then `qa` pass 2
- Codex lane ownership: `state`, `api`, `contracts`, then `qa` pass 1
- Both can run recurring `docs` maintenance from the docs-drift feature pack
- Sequential QA is triggered by `handoff/qa-codex/<feature-slug>` then `handoff/qa-claude/<feature-slug>`

Queue commands:

```bash
bun run plans queue --agent claude --lane ui
bun run plans queue --agent codex
bun run plans queue --agent claude --lane docs
bun run plans queue --agent codex --lane docs
bun run plans queue --agent claude --lane qa --handoff-ready
bun run plans queue --agent codex --lane qa --handoff-ready
```

---

## Skills

Skills are domain knowledge that Claude loads when relevant. Most activate automatically based on keywords — you don't need to invoke them explicitly.

### Command Skills (explicitly invoked)

| Skill | Invocation | What it does |
|-------|-----------|--------------|
| **status** | `/status` | Morning briefing — pipeline, health, journeys, daily focus |
| **plan** | `/plan` | Step-by-step implementation planning |
| **debug** | `/debug` | Root cause investigation with hypothesis testing |
| **review** | `/review` | 6-pass systematic code review |
| **audit** | `/audit` | Dead code detection, dependency health |
| **principles** | `/principles` | Software engineering principles audit |
| **monitor** | `/monitor` | Quality gate watching |

### Domain Skills (auto-loaded by context)

| Skill | Activates when you say | Sub-files |
|-------|----------------------|-----------|
| **react** | "component", "hooks", "state", "error handling" | [compiler.md](react/compiler.md), [performance.md](react/performance.md), [error-handling.md](react/error-handling.md) |
| **web3** | "Safe", "passkey", "ERC-4337", "onchain" | — |
| **data-layer** | "Dexie", "Yjs", "sync", "offline", "local-first" | [storage-lifecycle.md](data-layer/storage-lifecycle.md), [service-worker.md](data-layer/service-worker.md) |
| **testing** | "test", "TDD", "vitest", "playwright" | — |
| **browser-verification** | "browser verification", "visual QA", "computer use", "rendered proof" | — |
| **skill-authoring** | "create skill", "update skill", "skill drift", "agent guidance" | — |
| **security** | "vulnerability", "XSS", "key exposure" | — |
| **performance** | "bundle size", "memory leak", "Lighthouse" | — |
| **architecture** | `/architecture`, "refactor", "module boundaries" | — |
| **ui-compliance** | "accessibility", "a11y", "WCAG" | — |

### Archived Skills

Skills consolidated into parent skills:

| Former Skill | Now Lives In | Reason |
|-------------|-------------|--------|
| `error-handling-patterns` | `react/error-handling.md` | Was a sub-concern of React development |

---

## Skill Bundles

Bundles group skills for common workflows. The system uses these to load the right context:

| Bundle | Skills loaded | When |
|--------|-------------|------|
| **extension-change** | react, testing, ui-compliance, browser-verification | Extension UI work |
| **shared-module-change** | react, web3, data-layer, testing | Shared module changes |
| **onchain-change** | web3, security, testing | Safe/passkey/chain work |
| **sync-change** | data-layer, testing, security | Yjs/sync/storage work |
| **app-change** | react, testing, ui-compliance, browser-verification | App/landing page work |
| **cross-package-change** | review, testing | Multi-package verification |
| **incident-hotfix** | debug, testing | Emergency response |

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

## Context Files

When working deeply in a package, Claude loads additional context:

| Working in | Context loaded | Content |
|-----------|---------------|---------|
| `packages/shared/` | `.claude/context/shared.md` | Module map, Dexie schema, Yjs patterns, Safe integration |
| `packages/extension/` | `.claude/context/extension.md` | MV3 architecture, runtime messaging, service worker |
| `packages/app/` | `.claude/context/app.md` | Landing page, React Flow board, receiver flows |
| Product questions | `.claude/context/product.md` | Vision, personas, brand direction, tone rules per surface |

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
| architecture | x | x | x |
| performance | x | x | x |
| ui-compliance | | x | x |

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
| Conventional commits with scope | CLAUDE.md |
| Biome format on save | Hook (auto) |
