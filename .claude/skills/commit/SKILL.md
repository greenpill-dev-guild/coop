---
name: commit
description: Organize and commit changes into logical thematic groups following conventional commit format. Use when the user says 'commit this', has many uncommitted changes, or wants to create well-structured commits.
disable-model-invocation: true
argument-hint: "[--all | --staged | message]"
user-invocable: true
allowed-tools: Bash, Read, Glob, Grep
---

# Commit Skill

Organizes uncommitted changes into logical, well-structured conventional commits.

## Workflow

### Phase 1: Inventory

1. Run `git status` to see all staged, unstaged, and untracked changes
2. Run `git diff --stat` for unstaged changes and `git diff --cached --stat` for staged
3. Categorize each changed file by:
   - **Package**: shared, app, extension, api, docs, claude (config), root
   - **Type**: feat, fix, refactor, chore, docs, test, perf, ci
   - **Concern**: What logical unit of work does this belong to?

### Phase 2: Group into Commits

Group changes into logical thematic commits. Rules:
- Each commit should be a single coherent unit of work
- Respect dependency order: shared changes before app/extension changes
- Never mix unrelated concerns in one commit
- Prefer fewer, well-scoped commits over many tiny ones
- Config/tooling changes (`.claude/`, `CLAUDE.md`, scripts) go in their own commit

Present the proposed grouping to the user:

```
Proposed commits (in order):

1. feat(shared): add JSDoc to coop module public exports
   - packages/shared/src/modules/coop/flows.ts
   - packages/shared/src/modules/coop/sync.ts

2. chore(claude): add visual verification hook and debug ladder
   - .claude/settings.json
   - .claude/skills/debug/SKILL.md
   - .claude/agents/cracked-coder.md

3. test(shared): add reusable test fixtures
   - packages/shared/src/__tests__/fixtures/index.ts

Proceed? [y/n/edit]
```

**Wait for user approval before creating any commits.**

### Phase 3: Pre-commit Validation

Before each commit:
1. Stage only the files for that commit (`git add <specific files>`)
2. Run `bun format` on staged files
3. Run `bun lint` to check for issues
4. If lint fails, fix and re-stage

### Phase 4: Create Commits

For each approved group:
1. `git add <files>`
2. `git commit -m "type(scope): description"` using conventional commit format
3. Verify commit succeeded

### Phase 5: Summary

After all commits:
1. Run `git log --oneline -N` (where N = number of new commits)
2. Report what was committed
3. **Never push** unless the user explicitly asks

## Commit Message Format

```
type(scope): concise description

Optional body with context if the change is non-obvious.
```

- **Types**: feat, fix, refactor, chore, docs, test, perf, ci
- **Scopes**: shared, extension, app, api, docs, claude, root
- Keep subject line under 72 characters
- Body explains "why", not "what"

## Modes

- `--all`: Include all changes (staged + unstaged + untracked)
- `--staged`: Only commit what's already staged
- No flag: Interactive — show all changes, let user pick

## Safety Rules

- Never push to remote unless explicitly asked
- Never force-push
- Never amend commits without asking
- Never commit `.env`, `.env.local`, or credential files
- Always present grouping for approval before committing
- If changes span shared + downstream, commit shared first
