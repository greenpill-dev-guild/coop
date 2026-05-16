---
name: skill-authoring
user-invocable: true
description: Create and maintain repo-local skills from repeated workflows, recurring corrections, and durable agent guidance. Use when adding a new skill, updating an existing skill, distilling a conversation into a skill, or auditing skill/index/registry drift.
argument-hint: "[new-skill-name | existing-skill-path]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-05-15"
last_verified: "2026-05-15"
---

# Skill Authoring Skill

Turns hard-won workflow knowledge into small, maintainable repo-local skills.

Use this when a conversation produces reusable guidance, when an agent needs repeated correction, or when a workflow has enough judgment that a plain script would be too brittle.

---

## Activation

| Trigger | Action |
|---------|--------|
| "create a skill" | Draft a new skill under `.claude/skills/<slug>/SKILL.md` |
| "turn this into a skill" | Distill the current workflow/corrections into durable instructions |
| "update this skill" | Patch the smallest existing skill surface |
| "audit skills" | Check index, registry, bundles, evals, and stale references |
| Repeated correction | Propose a skill update instead of repeating the correction again |

## When a Skill Is Worth It

Create or update a skill when at least one is true:

- The same correction has happened in multiple sessions.
- The workflow crosses tools, files, or validation steps.
- The task depends on Coop-specific judgment, not generic best practice.
- A flexible process is better than a rigid script because the task may start mid-stream.
- The guidance should survive context compaction and agent handoff.

Do not create a skill for one-off preferences, narrow temporary tasks, or guidance already covered by a nearby skill.

---

## Authoring Workflow

### 1. Find the Nearest Existing Skill

Before creating anything new:

1. Read `.claude/skills/index.md`.
2. Search `.claude/skills/**/SKILL.md` for overlapping triggers.
3. Prefer updating a sub-file or existing skill when the new guidance is a sub-concern.
4. Create a new top-level skill only when the activation surface is distinct.

### 2. Extract the Stable Rule

Distill the conversation into:

- **When to use it**: concrete triggers and non-triggers.
- **Workflow**: ordered steps the agent can follow.
- **Repo references**: exact files, scripts, or commands.
- **Validation**: what proves the workflow worked.
- **Failure modes**: common mistakes and how to recover.

Keep voice and examples repo-specific. Avoid generic "be helpful" instructions.

### 3. Write the Skill

Every active top-level skill needs YAML frontmatter:

```yaml
---
name: skill-slug
user-invocable: true
description: One concise sentence with trigger language and intended use.
argument-hint: "[optional-argument]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "YYYY-MM-DD"
last_verified: "YYYY-MM-DD"
---
```

Body shape:

1. Short purpose statement.
2. Activation table.
3. Ordered workflow.
4. Output or handoff contract when relevant.
5. Validation or maintenance checklist.
6. Related skills.

### 4. Wire the Skill

For active top-level skills:

- Add it to `.claude/skills/index.md`.
- Add it to `.claude/registry/skills.json`.
- Add or update `.claude/registry/skill-bundles.json` only when it belongs to a common workflow.
- Update `.claude/agents/*.md` or `.codex/agents/*.toml` only if an agent should load it routinely.
- Add an eval prompt under `.claude/evals/skills/` for judgment-heavy skills.

### 5. Verify Drift

Before finishing, check:

```bash
rg -n "old-skill-name|new-skill-name" .claude .codex AGENTS.md CLAUDE.md --glob '!.claude/worktrees/**'
jq empty .claude/registry/skills.json .claude/registry/skill-bundles.json .claude/registry/commands.json
```

If the skill changes command or validation guidance, verify the referenced command exists in `package.json`.

---

## Maintenance Rules

- Skills should point at repo truth, not duplicate large sections from `AGENTS.md` or `CLAUDE.md`.
- Use sub-files for deep references instead of making one top-level skill enormous.
- Archive stale skills by moving them under `.claude/skills/_archived/` and recording the replacement in `skills.json`.
- If a skill includes code examples, keep them aligned with this repo's actual stack.
- If a skill names an external tool or plugin, state the fallback when that tool is unavailable.
- If a skill changes behavior for code review, planning, or agent output, update `output-contracts.md` or explain why it does not apply.

## Related Skills

- `plan` -- Feature-pack and lane workflow.
- `review` -- Findings, severity, and human judgment callouts.
- `browser-verification` -- Visual/browser proof for UI-impacting skills.
- `design` -- Coop-specific visual and interaction judgment.
