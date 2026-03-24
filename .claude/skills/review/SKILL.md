---
name: review
description: Code Review & PR Creation - 6-pass systematic review covering correctness, security, performance, patterns, testing, and documentation. Use when reviewing a PR, auditing code changes, or the user asks for systematic code quality analysis.
context: fork
agent: code-reviewer
argument-hint: "[file-or-PR]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Review Skill

Code review workflow: request reviews, perform 6-pass analysis, process feedback.

**References**: See `CLAUDE.md` for codebase patterns and conventions.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/review` | Perform 6-pass code review |
| `/review --mode verify_only --scope cross-package` | Cross-package verification pass |
| `/review --mode apply_fixes` | Explicit review-and-fix pass |
| After implementation | Request review |
| PR feedback received | Process and respond |

## Scope Confirmation

When invoked without specific files or PR reference, echo back scope before reviewing:

```
Review scope: [files/PR/branch described]
Mode: [report_only | verify_only | apply_fixes]
Packages affected: [shared | app | extension | multiple]

Proceed? [y/n]
```

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` -> Session Continuity.

## Modes

- **Default mode**: `report_only`
- **Fix mode**: switch to `apply_fixes` only when explicitly requested (for example: `"apply fixes"`)
- **Cross-package verify**: `/review --mode verify_only --scope cross-package` — runs checks in dependency order (shared → app → extension), reports by severity. Use after migrations, dependency upgrades, or changes spanning multiple packages.

---

## Part 1: Perform Code Review (6-Pass Protocol)

> YOU DO NOT LET THINGS SLIP. YOU DESIRE ONLY PERFECTION.

### Pass 0: Change Explanation
- Document what changed and why in plain language
- Create Mermaid diagram showing component/data flow impact
- Identify the blast radius: which packages, modules, types are affected

**What to look for:**
- Can you explain the change in one sentence? If not, the PR may be too large
- Does the PR description match what the code actually does?
- Are there unrelated changes mixed in?


### Pass 0.5: Issue Coverage (MANDATORY)

- Map every requirement from the issue/task to implementation
- **If coverage < 100%: STOP. Request changes.**

**What to look for:**
- Each acceptance criterion has a corresponding code change
- Edge cases mentioned in the issue are handled
- No scope creep — changes beyond the issue are flagged

**Example comment:**

```markdown
> **Issue Coverage: 2/3 (67%) -- BLOCKING**
> - Requirement 1: "Users can publish flows" -> `publishFlow()` in `ReviewPanel.tsx:45`
> - Requirement 2: "Show sync status" -> `SyncIndicator` component added
> - Requirement 3: "Retry failed publishes" -> No retry UI found
```


### Pass 1: Technical Issues

- Type errors, null handling, missing error handling
- API contract violations, race conditions
- Stale closures, memory leaks, async cleanup

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Unhandled promise rejection | Critical | `await foo()` without try/catch in mutation |
| Missing null check | High | `coop.flows.map()` when coop could be undefined |
| Race condition | Critical | Async effect without cleanup guard |
| Type assertion bypass | High | `as any` without documented reason |
| Missing error boundary | Medium | New route without ErrorBoundary wrapper |


### Pass 2: Code Consistency

- Follows codebase style and existing patterns
- Dead code, duplicate logic, naming conventions
- Import patterns (barrel imports only)

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Deep import path | Medium | `from "@coop/shared/modules/auth/useAuth"` |
| Inconsistent naming | Low | `handleClick` vs `onClick` vs `onPress` |
| Dead code | Medium | Commented-out code, unused variables |
| Duplicate logic | Medium | Re-implementing a pattern that exists in shared |
| Console.log in production | Medium | `console.log("debug")` left in |


### Pass 3: Architecture

- Modules in shared package only (see CLAUDE.md)
- Proper abstractions, single responsibility
- Local-first patterns respected

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Module defined outside shared | Critical | Business logic in extension package |
| Network-first pattern | High | Direct fetch without offline fallback |
| Entire store selected | High | Subscribing to full Dexie table without filter |


### Pass 4: Environment Compatibility

- No package-specific .env files
- Browser extension compatibility (MV3 constraints)
- Offline behavior for any write operations
- Service worker / background worker impact

**What to look for:**

| Issue | Severity | Example |
|-------|----------|---------|
| Package-specific .env | Critical | `.env` file in `packages/extension/` |
| Missing offline fallback | High | Feature breaks when offline |
| MV3 incompatible API | Critical | Using `chrome.extension` (deprecated) |
| Browser API without feature detection | Medium | Using API without checking availability |

### Pass 5: Verification Strategy

```bash
# Full workspace verification
bun format && bun lint && bun run test && bun build
```

**What to verify:**
- All existing tests still pass
- New behavior has test coverage
- No TypeScript errors introduced
- Build succeeds for affected packages

### Pass 6: Synthesis

- **APPROVE** or **REQUEST CHANGES**
- Summarize all findings by severity
- Provide actionable next steps

---

## Part 2: Review Output

```markdown
## Code Review: [PR Title]

### Summary
[Scope + change explanation + requirement coverage]

### Severity Mapping
- `Critical|High -> must-fix`
- `Medium -> should-fix`
- `Low -> nice-to-have`

### Must-Fix
- [Issue] - `file.ts:123` -- [Critical/High finding]

### Should-Fix
- [Issue] - `file.ts:456` -- [Medium finding]

### Nice-to-Have
- [Suggestion] - `file.ts:789` -- [Low finding]

### Verification
`bun run test`
`bun lint`
`bun build`

### Recommendation
**[APPROVE / REQUEST_CHANGES]**
[Brief rationale]
```

### Severity Guide

| Severity | Meaning | Action |
|----------|---------|--------|
| **Critical** | Breaks functionality, security issue, architectural violation | Must fix before merge |
| **High** | Performance issue, missing error handling, type safety gap | Should fix before merge |
| **Medium** | Style inconsistency, minor optimization, missing test | Fix in this PR or create follow-up issue |
| **Low** | Suggestion, nitpick, alternative approach | Author's discretion |

### Severity Mapping

| Review Severity | Action Bucket |
|----------------|---------------|
| Critical | must-fix |
| High | must-fix |
| Medium | should-fix |
| Low | nice-to-have |

### Post to GitHub

```bash
gh pr comment [PR_NUMBER] --body "[review content]"
```

Only post when PR context exists. For working-copy reviews, return findings in chat.

---

## Part 3: Request Review

```bash
# Prepare
git log main..HEAD --oneline
bun build && bun run test && bun lint

# Create PR
gh pr create --title "feat(scope): description" --body "..."
```

---

## Part 4: Process Feedback

### Evaluation

1. Read completely — don't react to individual points
2. Verify against codebase
3. Respond appropriately

### Response Types

| Situation | Response |
|-----------|----------|
| Valid | "Implementing as suggested" |
| Unclear | "Which specific line should be addressed?" |
| Incorrect | "This conflicts with X because..." |

### When to Push Back

- Breaks existing functionality
- Lacks codebase context
- Violates YAGNI
- Violates Coop conventions (see CLAUDE.md)

---

## Anti-Patterns

- **Rubber-stamp approvals** — Every PR gets the full 6-pass treatment; never approve without reading every changed line
- **Reviewing only the diff** — Context matters; read surrounding code to understand if the change fits
- **Severity inflation** — Not everything is critical; reserve "Critical" for actual blockers
- **Ignoring test coverage** — New behavior without tests is incomplete, even if the code is correct
- **Reviewing > 800 LOC at once** — Ask the author to split; large PRs hide bugs
- **Commenting without suggestions** — "This is wrong" is not actionable; "Use X instead because Y" is

## Final Gates

- **ANY COVERAGE < 100%** -> DO NOT APPROVE
- **ANY UNRESOLVED CRITICAL/HIGH** -> DO NOT APPROVE
- **POST TO GITHUB ONLY IN PR CONTEXT**

## Related Skills

- `testing` — Test coverage verification in Pass 5
- `audit` — Broader codebase health checks beyond PR scope
