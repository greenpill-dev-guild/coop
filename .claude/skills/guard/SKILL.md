---
name: guard
description: Run lint + test + build checks and report regressions. Use standalone for a one-shot check, or with /loop for continuous monitoring (e.g. `/loop 5m /guard`).
disable-model-invocation: true
argument-hint: "[--fix] [duration|count]"
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
model: opus
---

# Guard Skill

Full quality gate with iteration-aware state tracking. Detects regressions, not just failures.

## State Model

You MUST maintain mental state across loop iterations. On every run, track:

```
BASELINE (captured on run 1):
  format_ok: bool
  lint_ok: bool
  test_count: number (total passing)
  test_failures: string[] (failing test names)
  build_ok: bool

CURRENT (this run):
  same fields as baseline

DELTA (computed):
  new_failures: tests that were passing in baseline but now fail
  fixed: tests that were failing in baseline but now pass
  format_regressed: was ok, now not
  build_regressed: was ok, now not
  drift_detected: any negative delta from baseline
```

## Run Protocol

### Run 1 — Establish Baseline

1. Run `bun format --check 2>&1` — capture exit code
2. Run `bun lint 2>&1` — capture exit code
3. Run `bun run test 2>&1` (NEVER `bun test`) — capture pass/fail counts and failing test names
4. Run `bun build 2>&1` — capture exit code and any errors

Record all results as the **baseline**. Output:

```
Guard baseline established
| Check  | Status | Count |
|--------|--------|-------|
| Format | PASS   |       |
| Lint   | PASS   |       |
| Tests  | PASS   | 47/47 |
| Build  | PASS   |       |
```

If there are pre-existing failures, list them clearly — these are **known issues**, not regressions:
```
Known issues (pre-existing):
  FAIL packages/shared/src/modules/coop/__tests__/flows.test.ts > createCoop > deterministic address
```

### Run 2+ — Detect Regressions

Run the same four checks. Compare every result against the **baseline** (not the previous run — always compare to baseline to prevent gradual drift).

**Regression** = something that was passing at baseline but now fails.
**Fix** = something that was failing at baseline but now passes.
**Stable failure** = was failing at baseline, still failing. Not a regression.

Output for clean runs (no change from baseline):
```
Guard #3 — No regressions. All clear.
```

Output when regressions are detected:
```
Guard #4 — REGRESSION DETECTED

REGRESSIONS (new since baseline):
  Tests: 2 new failures
    FAIL packages/extension/src/runtime/__tests__/config.test.ts > resolveChain > defaults to sepolia
    FAIL packages/shared/src/modules/auth/__tests__/auth.test.ts > createPasskeySession > mock mode

FIXES (improved since baseline):
  Tests: 1 fixed
    PASS packages/shared/src/modules/coop/__tests__/flows.test.ts > createCoop > deterministic address

STABLE (unchanged from baseline):
  Format: PASS | Lint: PASS | Build: PASS
```

### Critical Anti-Drift Rules

1. **Always compare to baseline, never to the previous run.** Comparing to the previous run allows gradual degradation (boiling frog). The baseline is your anchor.
2. **Never normalize failures.** If a test fails on run 3 that passed on run 1, it's a regression on every subsequent run until fixed — even if it was also failing on run 4. Don't stop reporting it.
3. **Track failure identity, not just count.** "2 tests failing" is not the same state if different tests are failing. Track by test name.
4. **Distinguish flaky from broken.** If a test fails on run 3, passes on run 4, fails on run 5 — flag it as flaky:
   ```
   FLAKY (intermittent since baseline):
     packages/shared/src/modules/coop/__tests__/sync.test.ts > connectProviders > reconnect
     Passed: runs 1,2,4 | Failed: runs 3,5
   ```
5. **Never silently drop context.** If you lose track of the baseline due to context limits, say so explicitly and re-establish it on the next run.

## Arguments

- `--fix`: Run `bun format` (write mode) and `bun lint --fix` before checking. Only fixes format/lint — never modifies test or source files.
- Duration (`1h`, `45m`): Override time limit
- Count (`3`, `10`): Override iteration cap

## Loop Termination

Default: **30 minutes or 6 iterations**, whichever comes first.

After the final iteration, print a summary comparing end state to baseline:

```
Guard complete — 6 runs over 30m
Baseline: 47 tests passing, format ok, lint ok, build ok
Final:    45 tests passing, format ok, lint ok, build ok
Delta:    -2 tests (regressions), 0 fixes
Regressions:
  FAIL config.test.ts > resolveChain > defaults to sepolia
  FAIL auth.test.ts > createPasskeySession > mock mode
```

## Commands

- `bun format --check` — format verification (no writes)
- `bun lint` — Biome lint
- `bun run test` — Vitest (NEVER `bun test`)
- `bun build` — shared → app → extension build chain

## Hard Rules

- NEVER use `bun test` — always `bun run test`
- NEVER modify source files unless `--fix` is passed (and even then, only format/lint)
- NEVER attempt to fix test failures — report them
- NEVER treat a regression as expected just because it persisted across runs
- Build order matters: shared must build before app and extension
