# Extension Flow Eval: Fresh Install to Simple Coop

**Status**: ready
**Last run**: —
**Last score**: —

## Scenario

Validate the first-run extension path for a non-technical user:

> Open Coop in a clean browser profile, create a coop with the minimum required
> fields, and confirm the user lands in the simple Chickens-first sidepanel.

## Setup

- Build the extension: `cd packages/extension && bun run build`.
- Use a clean Brave/Chromium-family profile with the unpacked extension loaded.
- Do not seed data manually.

## Steps

1. Open the popup from the extension toolbar.
2. Confirm the no-coop screen renders with:
   - `Ready to round up your loose chickens?`
   - primary CTA `Create a Coop`
   - secondary CTA `Join with Code`
3. Click `Create a Coop`.
4. In the sidepanel create form, fill only required fields:
   - Coop name: `Garden Grants`
   - Your display name: `Sun`
   - Purpose: `Find climate and public goods grants worth sharing.`
5. Complete any browser passkey prompt if it appears.
6. Click `Start This Coop`.
7. Confirm the sidepanel lands on the simple Chickens review path.
8. Open the `More options` menu.

## Expected Behavior

- Popup is not blank and no extension-card error appears.
- First-run copy is friendly and uses `Create a Coop`, not `Launch the Coop`.
- Creation does not expose wallet-first, Safe-first, archive, or operator setup by default.
- After creation, the visible sidepanel path is Chickens-first:
  - Review/Shared segmented control is visible.
  - Empty state says `Round up your loose chickens` if no captures exist.
  - Bottom Roost/Chickens/Coops/Nest footer nav is hidden.
  - `More options` menu shows Review chickens, Shared with coop, Settings, Advanced view.

## Failure Conditions

- Popup or sidepanel is blank.
- Primary CTA text regresses away from `Create a Coop`.
- User lands in Roost, Coops, or a complex Nest workspace after creation.
- Simple mode exposes Safe, signer, archive key, policy, session, or agent queue details.
- `chrome://extensions` / `brave://extensions` shows an extension error.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Full flow passes with screenshots and clean extension-card evidence |
| 2 | Flow completes, but one non-blocking UX or evidence gap remains |
| 1 | Popup loads but create/simple landing path is blocked or confusing |
| 0 | Popup/sidepanel/runtime error prevents the flow |
