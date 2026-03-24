# Phase 1: Agent Workflow Guardrails

## Context

Rapid post-hackathon development left the codebase with multi-agent workflow friction: full builds conflict when agents run concurrently, agents create new UI components instead of reusing existing shared ones, and there's no lightweight validation tier for scoped changes. This plan addresses these issues with targeted CLAUDE.md guidance and a missing validation suite.

## What's Already Done

- [x] `typecheck` script added to `package.json` (line 61): runs `tsc --noEmit` across shared, app, and extension
- [x] `typecheck` leaf suite added to `scripts/validate.ts` (lines 28-32)

## Status: COMPLETE (all tasks done as of 2026-03-24)

All items verified in current codebase: quick suite exists in validate.ts, verification tiers in CLAUDE.md, component reuse guidance in CLAUDE.md, validation suites section updated, and validate:quick/validate:typecheck scripts in package.json.

## Tasks (all complete)

### 1. Add `quick` composite suite to `scripts/validate.ts`

The `quick` composite suite was not added because the linter reformatted the file after the first edit. Re-read the file and add after the last leaf suite (before `smoke`):

```typescript
quick: {
  description: 'Fastest useful validation: typecheck + lint (~15s). No build or tests.',
  includes: ['typecheck', 'lint'],
},
```

**File**: `scripts/validate.ts`
**Insert before**: the `smoke` suite definition

### 2. Add tiered verification guidance to CLAUDE.md

Add a new section after "Build and Verify" in Key Patterns. This replaces the blanket "always rebuild" rule with a tiered approach:

```markdown
**Verification Tiers**: Not every change needs a full build. Choose the lightest tier that covers your change:

| Tier | Command | When to use | ~Time |
|------|---------|-------------|-------|
| **typecheck** | `bun run validate typecheck` | Single-package changes, no shared export changes | ~10s |
| **quick** | `bun run validate quick` | Typecheck + lint, good for formatting/type fixes | ~15s |
| **smoke** | `bun run validate smoke` | Cross-package changes, shared module edits | ~1m |
| **build** | `bun build` | CSS token changes, new shared exports, pre-commit | ~45s |
| **core-loop** | `bun run validate core-loop` | UI workflow changes needing E2E confirmation | ~5m |

Use `typecheck` or `quick` during iteration. Use `smoke` or higher before committing. Full `bun build` is required when: changing `@coop/shared` exports consumed by downstream packages, modifying CSS tokens in `shared/src/styles/`, or as part of pre-commit validation.
```

**File**: `CLAUDE.md`
**Insert after**: the "Build and Verify" paragraph (line 88)
**Also update**: the existing "Build and Verify" text to say "choose the appropriate verification tier" instead of "ALWAYS rebuild"

### 3. Add shared component reuse guidance to CLAUDE.md

Add after the new verification tiers section:

```markdown
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
```

**File**: `CLAUDE.md`
**Insert after**: the verification tiers section added in task 2

### 4. Update Validation Suites section in CLAUDE.md

Add `typecheck` and `quick` to the suite list:

```markdown
- `typecheck`: Fast type-check only (~10s, no build)
- `quick`: Typecheck + lint (~15s)
```

**File**: `CLAUDE.md`
**Insert at**: the Validation Suites section (around line 123), before the existing `smoke` entry

### 5. Add `validate:quick` and `validate:typecheck` shortcut scripts to package.json

For consistency with existing `validate:smoke`, `validate:full`, etc.:

```json
"validate:typecheck": "bun run ./scripts/validate.ts typecheck",
"validate:quick": "bun run ./scripts/validate.ts quick",
```

**File**: `package.json`
**Insert near**: the other `validate:*` scripts (around line 49)

## Verification

After all edits:

```bash
# Verify typecheck works
bun run validate typecheck

# Verify quick works
bun run validate quick

# Verify suite list shows new entries
bun run validate list

# Run smoke to confirm nothing broken
bun run validate smoke
```

## Files to Modify

1. `scripts/validate.ts` — add `quick` composite suite
2. `CLAUDE.md` — add verification tiers, component reuse guidance, update validation suites list
3. `package.json` — add `validate:typecheck` and `validate:quick` shortcut scripts
