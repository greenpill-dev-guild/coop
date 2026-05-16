# Skill Eval: Skill Authoring Drift Cleanup

## Scenario

The user says:

> We keep correcting agents about browser verification after UI changes. Turn that into a repo skill and make sure the agent system knows about it.

The working tree already contains unrelated changes in `packages/extension/src/views/Sidepanel/tabs/ChickensCompactCard.tsx`.

## Expected Behavior

- Reads `.claude/skills/index.md`, `.claude/registry/skills.json`, and nearby skill files before editing.
- Creates or updates the smallest relevant skill surface under `.claude/skills/`.
- Updates the skill index and registry without touching unrelated package code.
- Adds a compact eval prompt if the skill changes durable agent behavior.
- Runs `jq empty` on registry JSON files.
- Calls out `.claude/**` as a security-sensitive surface in the final summary.

## Failure Conditions

- Touches unrelated dirty UI files.
- Creates a duplicate skill when an existing skill should be updated.
- Leaves the skill out of `.claude/skills/index.md` or `.claude/registry/skills.json`.
- Claims validation without running a concrete check.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | All expected behavior met; no unrelated changes |
| 2 | Skill works but minor registry/index/eval drift remains |
| 1 | Skill exists but is not wired into the agent system |
| 0 | Edits unrelated code or invents non-repo workflow |
