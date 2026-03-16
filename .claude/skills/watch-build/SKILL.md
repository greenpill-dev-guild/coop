---
name: watch-build
description: Build all packages and report errors. Use standalone or with /loop (e.g. `/loop 5m /watch-build`).
argument-hint: "[duration|count]"
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
model: opus
---

# Watch Build Skill

Iteration-aware build monitor. Tracks per-package build health and detects regressions in the build chain.

## State Model

Maintain across all iterations:

```
BASELINE (run 1):
  packages:
    shared:    { ok: bool, errors: string[], warnings: string[] }
    app:       { ok: bool, errors: string[], warnings: string[] }
    extension: { ok: bool, errors: string[], warnings: string[] }
  total_ok: bool

HISTORY:
  per_package_results: Map<string, bool[]>  # package -> [ok/fail per run]
  error_fingerprints: Map<string, Set<string>>  # package -> set of error signatures

CURRENT (each run):
  same shape as baseline
```

## Run Protocol

### Run 1 — Establish Baseline

1. Run `bun build 2>&1` (builds shared → app → extension in dependency order)
2. Parse output for:
   - Per-package success/failure
   - Error messages with file paths and line numbers
   - Warning messages (TypeScript, bundler)
   - Build timing if available
3. Record as baseline

Output for clean build:
```
Build baseline — all packages OK
  shared ✓ | app ✓ | extension ✓
```

Output with pre-existing errors:
```
Build baseline — 2/3 packages OK
  shared ✓ | app ✓ | extension ✗

Known build errors:
  @coop/extension
    src/background.ts:142 — TS2307: Cannot find module '@coop/shared/internal'
    src/views/Sidepanel/sidepanel-app.tsx:891 — TS2345: Argument of type 'string' is not assignable
```

### Run 2+ — Diff Against Baseline

Build again. Compare each package against its **baseline result**.

Classify changes:

| Category | Meaning | Action |
|----------|---------|--------|
| **Regression** | Package built at baseline, fails now | Report with full error details |
| **Fix** | Package failed at baseline, builds now | Report as positive signal |
| **Stable pass** | Built at baseline, still builds | Silent |
| **Stable fail** | Failed at baseline, still fails | Check if error set changed |
| **New error** | Same package fails but with a different error | Report — could be cascading |
| **Cascade** | Shared fails → app/extension also fail | Identify root cause package |

Output for clean runs:
```
Build #3 — No regressions. All packages OK.
```

Output with regression:
```
Build #4 — REGRESSION DETECTED

REGRESSIONS:
  @coop/shared (was OK at baseline, now fails):
    src/contracts/schema.ts:215 — TS2304: Cannot find name 'ritualPhaseSchema'

  @coop/app (CASCADE from shared failure):
    Build skipped — depends on @coop/shared

  @coop/extension (CASCADE from shared failure):
    Build skipped — depends on @coop/shared

Root cause: @coop/shared — schema.ts line 215
```

Output with error mutation (same package fails but differently):
```
Build #5 — Error mutation in @coop/extension

  @coop/extension (still failing, but errors changed):
    RESOLVED: src/background.ts:142 — TS2307 Cannot find module
    NEW:      src/background.ts:89 — TS2339 Property 'coopDocs' does not exist

  This may indicate a partial fix that introduced a new issue.
```

### Anti-Drift Rules

1. **Baseline is sacred.** A package that built on run 1 must build on every subsequent run. If it stops building, that's a regression regardless of how many runs it's been failing.
2. **Track error identity, not just pass/fail.** A package that fails with a different error than baseline is a meaningful change — report it. Error fingerprint = `file:line:error_code`.
3. **Detect cascades.** If `@coop/shared` breaks, `app` and `extension` will likely also break. Identify the root cause package rather than listing three failures.
4. **Watch for warning escalation.** New TypeScript warnings that weren't in baseline could become errors. Note them.
5. **Build order is causal.** shared → app → extension. A shared failure explains downstream failures. Never blame app/extension for a shared regression.
6. **If you lose baseline context, say so.** Re-build and re-establish.

## Arguments

- Duration (`1h`, `45m`): Override time limit
- Count (`3`, `10`): Override iteration cap

## Loop Termination

Default: **30 minutes or 6 iterations**, whichever comes first.

Final summary:
```
Build watch complete — 6 runs over 30m
Baseline: shared ✓ | app ✓ | extension ✗ (1 known error)
Final:    shared ✓ | app ✓ | extension ✗ (1 known error, unchanged)
Regressions: 0
Fixes: 0
Error mutations: 0
```

Or with changes:
```
Build watch complete — 6 runs over 30m
Baseline: all OK
Final:    shared ✗ | app ✗ (cascade) | extension ✗ (cascade)
Regressions: 1 (shared — schema.ts:215)
Root cause: ritualPhaseSchema removed from schema.ts
```

## Hard Rules

- NEVER modify any files — read-only monitoring
- NEVER attempt to fix build errors — report only
- NEVER treat a regression as stable just because it persisted
- NEVER compare to previous run — always compare to baseline
- NEVER blame downstream packages for upstream failures — identify the root cause
- Build order: shared must succeed before app and extension
