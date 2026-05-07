---
feature: next-gen-model-readiness
title: Simplify the prompt surface
lane: docs
agent: claude
status: ready
source_branch: main
work_branch: feature/simplify-prompt-surface
depends_on:
  - ../spec.md
owned_paths:
  - .claude/context/
  - .claude/skills/
  - .claude/rules/tests.md
  - .claude/agents/
  - CLAUDE.md
done_when:
  - context/app.md lines < 20
  - context/extension.md lines < 20
  - context/shared.md lines < 20
  - skills/index.md deleted
  - rules/tests.md lines < 100
skills:
  - architecture
updated: 2026-05-07
---

# Phase 1: Simplify the Prompt Surface

Target: ~8,500 lines → ~3,000 lines. Remove library docs, static code maps, procedural recipes, duplicated constraints. Keep outcomes, constraints, anti-patterns, product intent.

## Required guardrail

Before deleting or shortening any instruction, classify it using `../context.md`:

- `deterministic-gate`: keep or move to code, hooks, schemas, validators, tests, or validation scripts.
- `repo-constraint`: keep once in the canonical repo instruction/rule surface.
- `product-intent`: preserve in product context or another short pointer.
- `soft-guidance`: remove or replace with a source pointer.

Do not convert a deterministic gate into prompt-only guidance. If the old prose was the only place a
gate existed, stop and route it to an executable surface or record the gap.

## Step 1: Replace context code maps with pointer files

Replace `.claude/context/app.md` (163 lines), `extension.md` (466 lines), `shared.md` (448 lines) with ~15-line pointer files. Each file becomes:

```markdown
# [Package] Context

## Key entry points
- `packages/[pkg]/src/[main-file].ts` — [what it does]
- [3-5 more key files]

## Constraints
- [2-3 non-derivable constraints specific to this package]

## Anti-patterns
- [2-3 things that have gone wrong before]

Read the source files above for architecture details.
```

**Keep `product.md` (196 lines) unchanged** — it contains non-derivable product intent.

**Verify**: Each pointer file < 20 lines. No constraint lost (cross-reference against rules/ files).

**Guardrail audit**: Record any removed `deterministic-gate`, `repo-constraint`, or `product-intent`
in the implementation notes with its new canonical home.

## Step 2: Reduce skills to constraint cards

For each `.claude/skills/*/SKILL.md`, reduce to 30-50 lines:

```markdown
# [Skill Name]

## When to activate
[1-2 sentences]

## Coop-specific constraints
- [Bullet list of things unique to this project]

## Anti-patterns
- [Things that have gone wrong before]
```

**Delete all**:
- Library API references (Vitest assertions, React hooks, Zustand patterns, Dexie schemas, Yjs API, Viem methods, WCAG guidelines)
- Generic methodology (TDD ceremony, Clean Architecture diagrams, debugging protocols)
- Code templates and examples (mock setup recipes, E2E boilerplate)

**Skills to process** (14 files, current → target lines):
- [ ] `security/SKILL.md`: 620 → ~50 (keep extension CSP rules, WebAuthn constraints)
- [ ] `audit/SKILL.md`: 423 → ~40 (keep dead-code detection triggers, Coop scope)
- [ ] `data-layer/SKILL.md`: 411 → ~40 (keep Dexie-Yjs bridge rules, persistence cleanup)
- [ ] `performance/SKILL.md`: 389 → ~30 (keep bundle budgets, Coop-specific thresholds)
- [ ] `react/SKILL.md`: 381 → ~30 (keep hook boundary rule, Dexie vs Zustand split)
- [ ] `testing/SKILL.md`: 346 → ~40 (keep mock strategy, coverage targets, anti-patterns)
- [ ] `debug/SKILL.md`: 339 → ~40 (keep 90-second sanity check, cross-layer debug table)
- [ ] `plan/SKILL.md`: 340 → ~40 (keep task decomposition heuristics, scope discipline)
- [ ] `ui-compliance/SKILL.md`: 328 → ~30 (keep Coop breakpoints, animation preferences)
- [ ] `web3/SKILL.md`: 266 → ~30 (keep "never use Wagmi", mock/live mode rules)
- [ ] `error-handling-patterns/SKILL.md`: 218 → ~30 (keep error categorization, retry rules)
- [ ] `monitor/SKILL.md`: 157 → ~30 (keep state model, anti-drift rules)
- [ ] `commit/SKILL.md`: 104 → ~20 (keep "present grouping for approval")
- [ ] `architecture/SKILL.md`: if exists, → ~40 (keep Cathedral Test, entropy reduction)

**Verify**: `wc -l .claude/skills/*/SKILL.md` shows each file 20-50 lines.

**Guardrail audit**: For each skill, keep Coop-specific constraints and anti-patterns; remove generic
methodology only after confirming enforcement-sensitive behavior lives in a rule, hook, schema, or test.

## Step 3: Delete meta-documentation

- [ ] Delete `.claude/skills/index.md` (238 lines) — meta-documentation about the prompt system itself. The model discovers skills via registry, not an index file.

**Verify**: File no longer exists. No references to it elsewhere.

## Step 4: Trim tests.md

Reduce `.claude/rules/tests.md` from 295 lines to ~80 lines:

**Keep**:
- When to mock vs real (constraint)
- Coverage targets (constraint)
- Anti-patterns (learned from incidents)
- Test file naming conventions (constraint)

**Remove**:
- Chrome API mock setup recipes (derivable from existing test files)
- Dexie test factory templates (derivable)
- E2E pattern code examples (derivable)
- Virtual WebAuthn setup guide (derivable)
- Multi-profile testing boilerplate (derivable)

**Verify**: `wc -l .claude/rules/tests.md` shows < 100 lines.

## Step 5: Trim CLAUDE.md

Remove ~120 lines from CLAUDE.md:

- [ ] Remove shared modules listing (lines 66-85, ~20 lines) — the model can `ls packages/shared/src/modules/`
- [ ] Remove verification tier table details — keep one line: "Run `bun run validate list` for available suites and `bun run validate smoke` as default pre-commit gate"
- [ ] Remove session continuity template — the PreCompact hook auto-saves session-state.md
- [ ] Remove planning OS directory layout — reference `bun run plans --help` and `.plans/README.md`
- [ ] Remove validation suite descriptions — duplicate of `scripts/validate.ts` content

**Keep**:
- Architecture overview and product loop
- Key principles (local-first, passkey-first, etc.)
- Key patterns (barrel imports, onchain integration, env vars)
- Infrastructure URLs
- Scope discipline and session scope lock
- Git workflow (branch naming, commit format)
- Post-agent regression review

**Verify**: `wc -l CLAUDE.md` shows < 200 lines. `bun run validate quick` passes.

**Guardrail audit**: Any removed release, permission, env, or command rule must still be enforced by a
hook, rule file, validator, test, or script.

## Step 6: Deduplicate constraints

For each constraint in the deduplication map (see context.md), ensure it appears in exactly one canonical location:

- [ ] Barrel imports → CLAUDE.md "Key Patterns" only. Remove from context/app.md, context/shared.md, agents/*.md
- [ ] `bun run test` → CLAUDE.md "Commands" + hook enforcement. Remove prose duplicates.
- [ ] Never create hooks in shared → rules/shared.md only. Remove from context/shared.md.
- [ ] Never use Date.now() → rules/shared.md only. Remove from context/shared.md.
- [ ] Never play sounds in SW → rules/extension.md only. Remove from context/extension.md.

**Verify**: `grep -r "barrel" .claude/ CLAUDE.md | wc -l` shows 1-2 hits (canonical location only).

## Step 7: Trim agent definitions

Review each `.claude/agents/*.md` for duplicated Coop rules:

- [ ] `cracked-coder.md` (67 lines): Remove Coop-Specific Rules section that duplicates CLAUDE.md. Keep TDD workflow reference but remove ceremony description.
- [ ] `code-reviewer.md` (60 lines): Keep output contract. Consider whether 6-pass protocol is procedural (the model knows how to review code).
- [ ] Others: Light touch — these are already lean.

**Verify**: No agent file duplicates a constraint that lives in CLAUDE.md or rules/.

## Final Verification

- [ ] `bun run validate quick` passes
- [ ] Total `.claude/` line count < 3,500 (down from ~8,500)
- [ ] No constraint was removed without being present elsewhere (audit trail in commit message)
- [ ] Every removed `deterministic-gate`, `repo-constraint`, and `product-intent` has an implementation-note entry naming its durable home
- [ ] `product.md` unchanged
