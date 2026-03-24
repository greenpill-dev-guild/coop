---
name: watch-tests
description: Run unit tests and report failures with context. Use standalone or with /loop (e.g. `/loop 3m /watch-tests`).
disable-model-invocation: true
argument-hint: "[package-filter] [duration|count]"
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
model: opus
---

# Watch Tests Skill

Iteration-aware test monitor. Tracks individual test identity across runs to detect regressions, fixes, and flaky tests.

## State Model

Maintain across all iterations:

```
BASELINE (run 1):
  total_pass: number
  total_fail: number
  total_skip: number
  passing_tests: Set<string>   # "file > suite > test name"
  failing_tests: Map<string, string>  # test name -> error message

HISTORY:
  per_test_results: Map<string, bool[]>  # test name -> [pass/fail per run]

CURRENT (each run):
  same shape as baseline
```

## Run Protocol

### Run 1 — Establish Baseline

1. Run `bun run test 2>&1` (or `bun run test --filter packages/$PACKAGE` if a package arg is provided)
2. Parse output for:
   - Total pass/fail/skip counts
   - Each failing test: file path, suite name, test name, assertion error
   - Each passing test: file path, suite name, test name
3. Record as baseline

Output:
```
Test baseline — 47 passed, 0 failed, 2 skipped
```

If pre-existing failures:
```
Test baseline — 45 passed, 2 failed, 2 skipped
Known failures:
  FAIL flows.test.ts > createCoop > deterministic address
    Expected "0xabc..." / Received "0xdef..."
  FAIL sync.test.ts > connectProviders > cleanup on disconnect
    TypeError: Cannot read properties of undefined (reading 'destroy')
```

### Run 2+ — Diff Against Baseline

Run tests again. Compare each test's result against its **baseline result** (not previous run).

Classify every test into exactly one bucket:

| Category | Meaning | Action |
|----------|---------|--------|
| **Regression** | Passed at baseline, fails now | Report immediately with full error |
| **Fix** | Failed at baseline, passes now | Report as positive signal |
| **Stable pass** | Passed at baseline, still passes | Silent |
| **Stable fail** | Failed at baseline, still fails | Mention count only, not details |
| **New test** | Not in baseline, now exists | Note it (pass or fail) |
| **Removed test** | In baseline, no longer exists | Note it |
| **Flaky** | Passed and failed across runs | Flag with run history |

Output for clean runs:
```
Tests #3 — 47 passed. No regressions.
```

Output with changes:
```
Tests #4 — 45 passed, 2 failed

REGRESSIONS (2 new since baseline):
  FAIL config.test.ts > resolveChain > defaults to sepolia
    Expected "sepolia" / Received undefined
  FAIL audio.test.ts > synthesize > rooster call frequency
    Timeout after 5000ms

Stable failures (2, unchanged): flows.test.ts, sync.test.ts
```

Output with flaky detection:
```
Tests #6 — 46 passed, 1 failed

FLAKY (inconsistent across runs):
  sync.test.ts > connectProviders > reconnect after wake
    Run history: PASS PASS FAIL PASS FAIL PASS
    Likely cause: timing-dependent, service worker lifecycle

Stable failures (1, unchanged): flows.test.ts
```

### Anti-Drift Rules

1. **Baseline is sacred.** Always compare to run 1. Never let the baseline creep. If 47 tests passed on run 1, that's the bar for every subsequent run.
2. **Track by test identity, not count.** "47 passing" on run 1 and "47 passing" on run 5 is NOT necessarily the same state — different tests could be passing/failing. Always compare the sets.
3. **Surface new failures every run they persist.** A regression on run 3 should still be reported on runs 4, 5, 6. Don't go silent on it.
4. **Detect count drift.** If total test count changes (tests added or removed), report it — it could indicate accidentally deleted test files or incomplete merges.
5. **If you lose baseline context, say so.** Re-run and re-establish. Never guess.

## Arguments

- Package filter (e.g., `shared`, `extension`, `app`): filters to `packages/$FILTER`
- Duration (`1h`, `45m`): Override time limit
- Count (`5`, `10`): Override iteration cap

## Loop Termination

Default: **30 minutes or 10 iterations**, whichever comes first.

Final summary:
```
Test watch complete — 10 runs over 30m
Baseline: 47 passed, 2 failed, 2 skipped
Final:    46 passed, 3 failed, 2 skipped
Regressions: 1 (config.test.ts > resolveChain)
Fixes: 0
Flaky: 1 (sync.test.ts > connectProviders > reconnect)
Stable failures: 2 (unchanged from baseline)
```

## Hard Rules

- NEVER use `bun test` — always `bun run test`
- NEVER modify any files — read-only monitoring
- NEVER attempt to fix failures — report only
- NEVER treat a regression as stable just because it persisted
- NEVER compare to previous run — always compare to baseline
