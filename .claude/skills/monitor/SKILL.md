---
name: monitor
description: Quality gate and regression monitor. One-shot (`/monitor`) or continuous (`/loop 5m /monitor`). Scope with --tests, --build, or run all checks by default.
disable-model-invocation: true
argument-hint: "[--tests|--build|--fix] [package-filter] [duration|count]"
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
model: opus
---

# Monitor Skill

Iteration-aware quality gate. Detects regressions against a stable baseline — not just failures.

## Modes

| Flag | Checks | Use Case |
|------|--------|----------|
| *(none)* | format + lint + tests + build | Full gate (default) |
| `--tests` | tests only | During implementation sprints |
| `--build` | build only | After cross-package changes |
| `--fix` | format + lint in write mode, then all checks | Auto-fix style issues first |

## State Model

Maintain across loop iterations:

```
BASELINE (captured on run 1):
  format_ok: bool
  lint_ok: bool
  test_count: number
  test_failures: Set<string>       # "file > suite > test name"
  passing_tests: Set<string>
  build_packages:
    shared:    { ok: bool, errors: string[] }
    app:       { ok: bool, errors: string[] }
    extension: { ok: bool, errors: string[] }

CURRENT (this run): same shape as baseline

DELTA (computed):
  new_failures: tests passing at baseline but failing now
  fixed: tests failing at baseline but passing now
  flaky: tests that oscillate across runs
  build_regressions: packages that built at baseline but fail now
  build_cascades: downstream failures caused by upstream breakage
```

## Run Protocol

### Run 1 — Establish Baseline

1. If `--fix`: run `bun format` and `bun lint --fix` first
2. Run applicable checks (all by default, scoped by flag):
   - `bun format --check 2>&1`
   - `bun lint 2>&1`
   - `bun run test 2>&1` (NEVER `bun test`) — parse per-test pass/fail identity
   - `bun build 2>&1` — parse per-package success/failure and error fingerprints
3. Record as baseline

Output:
```
Monitor baseline established
| Check  | Status | Detail          |
|--------|--------|-----------------|
| Format | PASS   |                 |
| Lint   | PASS   |                 |
| Tests  | PASS   | 47/47           |
| Build  | PASS   | shared ✓ app ✓ extension ✓ |
```

If pre-existing failures, list as **known issues** (not regressions).

### Run 2+ — Detect Regressions

Run same checks. Compare against **baseline** (never previous run — prevents drift).

**Classification**:
- **Regression** = passed at baseline, fails now → report with full detail
- **Fix** = failed at baseline, passes now → report as positive
- **Stable failure** = failed at baseline, still fails → count only
- **Flaky** = oscillates across runs → flag with run history
- **Cascade** = downstream build failure caused by upstream → identify root cause package

Output for clean runs:
```
Monitor #3 — No regressions. All clear.
```

Output with regressions:
```
Monitor #4 — REGRESSION DETECTED

REGRESSIONS:
  Tests: 2 new failures
    FAIL config.test.ts > resolveChain > defaults to sepolia
    FAIL auth.test.ts > createPasskeySession > mock mode
  Build: @coop/shared (was OK, now fails)
    src/contracts/schema.ts:215 — TS2304: Cannot find name 'ritualPhaseSchema'
    CASCADE: app ✗, extension ✗ (depend on shared)

FIXES: 1 test now passing
FLAKY: sync.test.ts > reconnect (PASS/FAIL/PASS/FAIL)
```

## Build-Specific Rules

- Build order is causal: **shared → app → extension**
- If shared breaks, downstream failures are cascades — report root cause only
- Track error identity (file:line:code), not just pass/fail
- New warnings that weren't in baseline may become errors — note them

## Test-Specific Rules

- Track by test identity (`file > suite > name`), not count
- "47 passing" on run 1 and "47 passing" on run 5 may be different tests — always compare sets
- Surface regressions every run they persist — don't go silent
- Package filter: `bun run test --filter packages/$PACKAGE`

## Anti-Drift Rules

1. **Baseline is sacred.** Always compare to run 1. Never let the baseline creep.
2. **Track identity, not counts.** Different tests/errors can produce the same numbers.
3. **Never normalize failures.** A regression is a regression until fixed.
4. **Detect flaky tests.** Track per-test pass/fail history across runs.
5. **If you lose baseline context, say so.** Re-establish on the next run.

## Arguments

- `--tests`: Test checks only
- `--build`: Build checks only
- `--fix`: Run format/lint in write mode before checking
- Package filter (e.g., `shared`, `extension`): scope tests to `packages/$FILTER`
- Duration (`1h`, `45m`): Override time limit
- Count (`3`, `10`): Override iteration cap

## Loop Termination

Default: **30 minutes or 6 iterations**, whichever comes first.

Final summary compares end state to baseline:
```
Monitor complete — 6 runs over 30m
Baseline: 47 tests, format ok, lint ok, build ok
Final:    45 tests, format ok, lint ok, build ok
Delta:    -2 tests (regressions), 0 fixes, 1 flaky
```

## Hard Rules

- NEVER use `bun test` — always `bun run test`
- NEVER modify source files (unless `--fix`, and even then only format/lint)
- NEVER attempt to fix test/build failures — report only
- NEVER compare to previous run — always compare to baseline
- NEVER blame downstream packages for upstream failures — identify root cause
- Build order: shared must succeed before app and extension
