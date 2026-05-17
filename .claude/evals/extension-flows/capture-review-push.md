# Extension Flow Eval: Capture, Review, Push

**Status**: ready
**Last run**: —
**Last score**: —

## Scenario

Validate the core loop after a coop exists:

> Capture grant-related browser context, review the resulting chicken, and push
> the useful item into the coop without falling into advanced workspace controls.

## Setup

- Start from a profile with one active coop, preferably created by
  `fresh-install-create-coop.md`.
- Serve deterministic fixture pages:

  ```bash
  python3 -m http.server 8765 --directory .claude/evals/extension-flows/fixtures
  ```

- Open these pages in normal browser tabs:
  - `http://127.0.0.1:8765/garden-grants.html`
  - `http://127.0.0.1:8765/watershed-resilience.html`
  - `http://127.0.0.1:8765/solar-coop.html`
- Keep receiver PWA/mobile capture out of scope for this eval.

## Steps

1. Open a grant page tab.
2. Open the Coop popup.
3. Click `Capture Tab`.
4. If the popup offers a review-before-saving dialog, save the capture.
5. Repeat for the other two fixture tabs.
6. Open the sidepanel.
7. Confirm the sidepanel is on Chickens Review.
8. If prompted for site access, grant only the requested local tab access and continue.
9. Wait up to 90 seconds for a captured item or generated draft to appear.
   Refresh the sidepanel once after 45 seconds if no item is visible.
10. Confirm the card shows high-signal simple-mode information:
    - title
    - why/insight or what Coop noticed
    - source/domain or thumbnail when available
    - push control
11. Click `Push to Garden Grants` or the equivalent target coop button.
12. Switch to `Shared`.

## Expected Behavior

- Capture action provides visible feedback and does not duplicate a recent capture silently.
- At least one fixture page title or source domain appears in popup or Chickens within 90 seconds.
- Chickens Review is the main working surface; category filters and feedback controls are not top-level in simple mode.
- The push action is available on actionable items.
- After push, the item disappears from Review or is no longer pending, and a shared item appears in Shared.
- No hidden advanced surface is required to complete capture -> review -> push.
- Extension-card errors remain clean.

## Failure Conditions

- `Capture Tab` is unavailable on a normal web page without clear remediation.
- Captured work does not become visible anywhere in popup or Chickens.
- No generated draft appears after 90 seconds and no pending captured item is visible as a fallback.
- User must use Roost, Coops, Nest Agent, archive, Safe, or policy controls to complete the loop.
- Push action fails without a surfaced error.
- Shared segment does not reflect the pushed item.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Capture -> Review -> Push -> Shared works with screenshots and clean error evidence |
| 2 | Core loop works but one state transition or copy point is unclear |
| 1 | Capture works, but review/push/shared path is blocked |
| 0 | Runtime or extension error prevents capture or review |
