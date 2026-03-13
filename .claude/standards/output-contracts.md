# Output Contracts (Deterministic)

Canonical source for output shape, severity mapping, and mode flags used by `.claude/agents` and `.claude/skills`.

## Mode Flags

| Mode | Meaning | Allowed Side Effects |
|------|---------|----------------------|
| `report_only` | Analyze and report findings only | No code changes |
| `verify_only` | Run checks and report pass/fail | No code changes |
| `apply_fixes` | Implement approved or explicitly requested fixes | Code changes allowed |

## Severity Mapping

Use this mapping across all review surfaces:

| Source Severity | Action Bucket |
|----------------|---------------|
| `Critical` or `High` | `must-fix` |
| `Medium` | `should-fix` |
| `Low` | `nice-to-have` |

Additional rule:
- `P0-P4` is reserved for triage/incident classification only. Do not mix `P0-P4` into code-review severity lists.

## Ordered Output Templates

### Review Surfaces (`review`, `code-reviewer`, `autonomous-review`, `cross-package-verify`)

Required section order:
1. `Summary`
2. `Severity Mapping`
3. `Must-Fix`
4. `Should-Fix`
5. `Nice-to-Have`
6. `Verification`
7. `Recommendation`

### Triage (`triage`)

Required section order:
1. `Classification` (`P0-P4`)
2. `Affected Packages`
3. `Recommended Route`
4. `Context for Next Agent`

### Migration (`migration`)

Required section order:
1. `Summary`
2. `Blast Radius`
3. `Execution Order`
4. `Validation Results`
5. `Risks / Rollback`
6. `Completion Checklist`

## Acceptance Criteria (Definition of Done)

### Triage

- [ ] Severity assigned (P0-P4) with evidence
- [ ] Type classified (bug, feature, enhancement, security, migration, performance, docs)
- [ ] Complexity rated (low, medium, high)
- [ ] Affected packages identified with impact summary
- [ ] Routing recommendation includes specific entry point skill
- [ ] 1-3 sentence handoff context provided for the next agent
- [ ] Completed within 5 turns

### Code Reviewer

- [ ] All 6 review passes executed (no skipped passes)
- [ ] Every finding has severity + file:line evidence
- [ ] Severity mapping applied (Critical|High -> must-fix, Medium -> should-fix, Low -> nice-to-have)
- [ ] Verification commands run (`bun format && bun lint && bun run test && bun build`)
- [ ] Final verdict is APPROVE or REQUEST_CHANGES (never ambiguous)
- [ ] No files edited or written (strictly read-only)
- [ ] Output follows ordered template

### Oracle

- [ ] Minimum 3 research paths attempted
- [ ] Every finding has confidence rating (High/Medium/Low)
- [ ] Sources cited (file:line for code, URLs for external)
- [ ] Evidence vs. inference clearly distinguished
- [ ] Executive summary provided (1-2 sentences)
- [ ] Synthesis section connects findings across sources
- [ ] No files edited or written (strictly read-only)

### Cracked Coder

- [ ] Failing tests written before implementation (TDD)
- [ ] All tests pass (`bun run test`)
- [ ] Lint passes (`bun lint`)
- [ ] Build succeeds (`bun build`)
- [ ] Module boundaries respected (shared modules in @coop/shared)
- [ ] Barrel exports updated if new public API was added
- [ ] Cathedral Check performed (most similar existing file used as reference)

### Migration

- [ ] Blast radius assessment completed before any code changes
- [ ] Dependency order followed: shared -> app -> extension
- [ ] Each package builds and tests pass before moving to the next
- [ ] Incremental commits per successfully migrated package
- [ ] Cross-package validation passed (`bun build && bun lint && bun run test`)
- [ ] Rollback path documented

## Cross-Agent Routing Matrix

When an agent discovers work exceeding its scope, use this matrix:

| Discovering Agent | Discovery | Action |
|---|---|---|
| **triage** | P0/P1 severity | Route to `/debug --mode incident_hotfix`, note urgency |
| **triage** | 3+ affected packages | Add note: "Consider migration agent for cross-package coordination" |
| **code-reviewer** | Findings affect all 3 packages | Output recommends spawning migration agent |
| **code-reviewer** | Security finding (crypto, auth, keys) | Escalate to user with severity justification before handoff |
| **oracle** | Fix requires runtime testing | Escalate: "Hand off to cracked-coder with test plan" |
| **cracked-coder** | Task touches all 3 packages | STOP. Save progress. Recommend migration agent |
| **cracked-coder** | Discovers security vulnerability | STOP implementation. File finding as P0 triage input |
| **migration** | Breaking impact across all packages | Abort. Document findings. Recommend phased approach |

## Routing Defaults

- `review` defaults to `report_only`. `apply_fixes` requires explicit user phrasing.
- Cross-package verification routes through `/review --mode verify_only --scope cross-package`.
- `debug` defaults to `report_only`; test-first bugfixing routes through `/debug --mode tdd_bugfix`.
