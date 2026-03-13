---
name: ci-cd
user-invocable: false
description: GitHub Actions CI/CD patterns - workflow config, build matrix, caching, PR checks, status gates. Use for pipeline configuration and automation.
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# CI/CD Skill

GitHub Actions CI/CD guide: workflow patterns, caching, status gates, and local simulation.

---

## Activation

When invoked:
- Check `.github/workflows/` for existing workflows before creating new ones.
- Understand the per-package path-filtering pattern already in use.
- Review `CLAUDE.md` -> Commands for validation commands.

## Part 1: Pipeline Architecture

### Path-Filtering Pattern

Each workflow only runs when relevant files change:

```yaml
on:
  pull_request:
    paths:
      - 'packages/shared/**'
      - 'packages/app/**'
      - 'bun.lockb'
  push:
    branches: [main]
    paths:
      - 'packages/shared/**'
      - 'packages/app/**'
```

**Key**: App and extension workflows also trigger on `packages/shared/**` changes since they depend on shared.

### Concurrency Groups

Prevent redundant runs on rapid pushes:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Part 2: Workflow Patterns

### Standard Job Structure

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.5.0" # Pin for reproducible CI

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build dependencies
        run: bun --filter shared build

      - name: Run tests
        run: bun --filter app test

      - name: Build
        run: bun --filter app build
```

### Dependency Build Order in CI

```yaml
# When testing app or extension, build shared first
- name: Build shared (dependency)
  run: bun --filter shared build

# Extension depends on shared
- name: Build shared (dependency)
  run: bun --filter shared build
```

### Artifact Passing Between Jobs

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: bun build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: packages/app/dist/

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
```

## Part 3: Caching Strategy

### Bun Cache

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.bun/install/cache
    key: bun-${{ runner.os }}-${{ hashFiles('bun.lockb') }}
    restore-keys: |
      bun-${{ runner.os }}-
```

### What NOT to Cache

- `node_modules/` — Bun recreates from cache faster than restoring
- Build artifacts that depend on env vars — stale builds cause subtle bugs
- Lockfiles — always use `--frozen-lockfile`

## Part 4: PR Status Gates

### Required Checks

| Check | Blocks Merge | Why |
|-------|-------------|-----|
| Package tests | Yes | Prevents regressions |
| Build | Yes | Ensures deployability |
| Lint | Yes | Code consistency |
| E2E tests | No (advisory) | Flaky tests shouldn't block |

### Branch Protection

```text
Settings -> Branches -> Branch protection rules:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require linear history (rebase merging)
```

## Part 5: Secrets Management

### Naming Convention

```text
VITE_*              — Build-time env vars (exposed to client)
PRIVATE_*           — Server-side only secrets
DEPLOY_*            — Deployment credentials
```

### Security Rules

- Never echo secrets in workflow logs
- Use `environment` protection rules for production secrets
- Rotate secrets on team member departure
- Use OIDC tokens where possible (no long-lived secrets)

## Part 6: Local CI Simulation

### Pre-Commit Validation

Run the same checks locally before pushing:

```bash
# Full validation (same as CI)
bun format && bun lint && bun run test && bun build

# Quick check (just the essentials)
bun lint && bun run test
```

### Simulating CI Locally

```bash
# Test exactly what CI will test for a specific package
bun --filter shared build && bun --filter app test && bun --filter app build

# Run with frozen lockfile (catches dependency drift)
bun install --frozen-lockfile
```

## Anti-Patterns

- **Never run all tests without path filters** — wastes CI minutes on unchanged packages
- **Never skip `--frozen-lockfile`** — causes "works on my machine" drift
- **Never cache `node_modules/`** — Bun's own cache is faster and more reliable
- **Never hardcode secrets in workflow files** — use GitHub Secrets
- **Never ignore flaky tests** — fix or quarantine them, don't disable
- **Never skip dependency build order** — shared must build before app/extension

## Decision Tree

```text
What CI/CD work?
|
+-- New workflow? -------------------> Part 1: Pipeline Architecture
|                                   -> Follow path-filtering pattern
|                                   -> Add concurrency group
|
+-- Workflow optimization? ---------> Part 3: Caching Strategy
|                                   -> Cache Bun
|                                   -> Avoid caching node_modules
|
+-- PR not passing checks? --------> Part 4: Status Gates
|                                   -> Check which gate failed
|                                   -> Run locally to reproduce
|
+-- Adding secrets? ----------------> Part 5: Secrets Management
|                                   -> Follow naming convention
|                                   -> Use environment protection
|
+-- Testing CI locally? ------------> Part 6: Local Simulation
                                    -> bun format && bun lint && bun run test && bun build
```

## Related Skills

- `git-workflow` — Branch strategy and commit conventions that CI validates
- `testing` — Test patterns that CI pipelines execute
