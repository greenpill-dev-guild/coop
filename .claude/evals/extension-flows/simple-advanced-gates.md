# Extension Flow Eval: Simple Mode and Advanced Gates

**Status**: ready
**Last run**: —
**Last score**: —

## Scenario

Validate the "hide, do not remove" architecture:

> A simple user sees only the guided review/share/settings path, while an
> advanced user can intentionally reveal the full workspace without behavior
> regressions.

## Setup

- Start from a profile with one active coop.
- Use the sidepanel in a real loaded extension.

## Steps

1. Confirm the current mode is simple by observing the sidepanel default.
2. Verify the bottom footer nav is hidden in simple mode.
3. Open `More options`.
4. Click `Review chickens`; confirm Chickens Review is shown.
5. Open `More options`.
6. Click `Shared with coop`; confirm Chickens Shared is shown.
7. Open `More options`.
8. Click `Settings`; confirm a simple Nest settings/member surface opens.
9. Scan the simple settings/member surface for advanced leakage.
10. Open `More options`.
11. Click `Advanced view`.
12. Confirm advanced mode restores the footer nav and access to Roost, Chickens, Coops, and Nest.
13. Confirm advanced-only Nest sections such as Agent and Sources are visible only after Advanced view.

## Expected Behavior

- Simple mode default is Chickens, not Roost.
- Simple mode hides the footer nav.
- Simple mode Settings stays understandable and avoids raw implementation details.
- Advanced view is reachable but intentional.
- Advanced mode restores existing workspace surfaces without breaking navigation.
- Switching to advanced does not clear coop data or pending review items.

## Failure Conditions

- Simple mode shows footer nav by default.
- Simple mode exposes raw Safe, signer, policy, session, archive secret, or agent queue controls.
- Advanced view is unreachable.
- Advanced mode does not restore full navigation.
- Mode switching causes data loss, blank screens, or extension-card errors.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Simple and advanced gates behave exactly as intended with evidence |
| 2 | Gates work but one label or secondary surface is confusing |
| 1 | Simple mode mostly works but leaks major advanced controls |
| 0 | Mode switching breaks navigation or runtime state |
