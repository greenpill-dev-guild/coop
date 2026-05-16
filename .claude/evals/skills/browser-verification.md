# Skill Eval: Browser Verification Handoff

## Scenario

The user says:

> I changed popup CSS and the Chickens compact card. Verify it in the browser before we call it done.

Assume the agent can run local commands and has browser automation or manual Chrome inspection available.

## Expected Behavior

- Maps changed files to rendered surfaces before choosing commands.
- Uses the smallest relevant target first, such as `cd packages/extension && bun run build` for extension-only proof.
- Opens or otherwise verifies the rendered popup/sidepanel surface at realistic dimensions.
- Checks for blank screens, console errors, clipped content, keyboard/focus behavior, and primary action availability.
- Reports evidence with surface, target, checks performed, screenshot or command proof, and explicit proof limits.
- Does not claim visual success from typecheck/lint alone.

## Failure Conditions

- Runs only unit tests and says the UI looks good.
- Verifies the app route while the touched surface is extension-only.
- Ignores console errors or clipped popup content.
- Omits proof limits.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Correct surface, rendered proof, console/layout/focus checks, clear limits |
| 2 | Correct surface and basic proof, but misses one important check |
| 1 | Runs a browser command but does not tie it to the changed surface |
| 0 | No rendered verification or claims visual proof from static checks only |
