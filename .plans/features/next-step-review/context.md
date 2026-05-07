# Next-Step Review Context

## Product Grounding

- UX Surface Clarity established the default product frame: "Coop is a local-first browser assistant
  for turning scattered knowledge into reviewed opportunities and shared memory for your community
  or project."
- Coop strategy says trust beats automation theater. This feature keeps review/approval explicit
  and improves salience before adding autonomy.
- The product target is community/project coordination, not a general personal-life assistant.

## Relevant Existing Behavior

- `buildProactiveSignals` turns tab routings into reviewable signals and merges linked signal/draft
  pairs in Chickens.
- `buildSummary` drives badge state, Roost counts, and popup snapshot counts.
- `ChickensTab` already builds unified review items from signals, drafts, and stale observations.
- `publish-draft`, `update-review-draft`, and `promote-signal-to-draft` already preserve explicit
  confirmation before sharing.

## Constraints

- Keep feedback local-first. It must not sync, publish, archive, or write onchain.
- Do not delete drafts for "Not useful"; hide them from next-step review surfaces.
- Use existing background/runtime message patterns.
- Keep source-domain logic in shared or background code; views should only construct feedback
  payloads and render controls.
- Keep popup changes out of this pack unless a direct regression appears.

## Implementation Evidence

- `ReviewItemFeedback` schema added to shared agent contracts.
- `reviewItemFeedbacks` Dexie table added at DB version 24.
- `record-review-feedback` added to runtime messages and background review handlers.
- Dashboard summary/proactive-signal filtering now reads active review feedback.
- Chickens cards emit stable feedback subjects for draft, signal, and observation items.

## Residual QA Focus

- Confirm an item marked "Not useful" disappears from Chickens and badge counts after dashboard
  reload.
- Confirm "Remind later" hides the item, then returns after the stored `remindAt`.
- Confirm simple Roost does not expose raw agent terms in the "What's Next" path.
- Confirm advanced mode still restores existing agent/operator controls without behavior changes.
