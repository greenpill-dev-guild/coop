# Implementation Notes For Next-Step Review

## What Changed

- Added local `ReviewItemFeedback` records for `not-useful` and `remind-later`.
- Added Dexie `reviewItemFeedbacks` storage and active-feedback helpers.
- Added `record-review-feedback` to extension runtime messages and background handlers.
- Dashboard summary, badge inputs, coop badges, tab routings, and proactive signals now suppress
  active feedback records.
- Chickens review cards now carry stable feedback subjects and expose `Not useful` and
  `Remind later`.
- Roost "What's Next" uses plain next-step language instead of raw agent-management terms.

## Why It Changed

- Existing `TabRouting.status = dismissed` covered signals but not drafts or stale observations, so
  a small local feedback table was the least destructive way to support all review item kinds.
- Existing ritual cadence is free text, so `Remind later` falls back to three days instead of trying
  to infer a calendar schedule.
- Drafts are preserved when marked not useful because v1 feedback should quiet the assistant, not
  destroy local work.

## Human Judgment Callouts

- Persisted-state migration: Dexie version 24 adds a local table.
- Runtime boundary: `record-review-feedback` is an extension-local message.
- Privacy/product boundary: feedback remains local-only and is not synced or published.
- Visual QA remains: the new compact card buttons need a browser sweep for density and wrapping.

## Follow-Ups

- Run QA pass 1 against a clean handoff branch.
- Run QA pass 2 browser/visual validation for simple and advanced modes.
- Later releases can revisit learned salience or reputation, but that needs a separate privacy and
  permission plan.
