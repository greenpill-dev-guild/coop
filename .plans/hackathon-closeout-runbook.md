# Hackathon Closeout Runbook

Use this as the operator checklist for the final recording and Kaggle
submission. Codex owns the repo checks and docs updates; the user owns the
screen recording, upload, and authenticated Kaggle submit.

## 1. Repo and Browser Proof

```bash
git switch feature/hackathon-simplify
git status --short
bun install
cd packages/extension && bun run build
cd ../..
COOP_VERIFY_BROWSER=brave COOP_VERIFY_LABEL=final-pre-record node scripts/verify-real-chrome.cjs
```

Expected proof:

- `.plans/evidence/<date>-popup-final-pre-record.png` shows the hook and
  **Create a Coop** CTA.
- `.plans/evidence/<date>-sidepanel-final-pre-record.png` renders cleanly.
- `.plans/evidence/<date>-runtime-summary-final-pre-record.json` has
  `errorsCount: 0` and `evalProbe.ok: true`.
- The `chrome://extensions` Coop card shows no visible error button/panel.
  Save a screenshot to `.plans/evidence/` if checking it manually.

## 2. Recording Prep

- Browser frame: 1280x720.
- Coop name: `Community Garden Grants`.
- Grant tabs: USDA Urban Agriculture, EPA Environmental Justice, NRCS
  Conservation Stewardship.
- Screenshot: one awkward PDF-heavy grant page.
- Voice memo script: `We need irrigation funding for the south plot before
  July. Two gardeners can co-write the application.`
- Pre-warm Gemma 4 in the same Brave/browser session before starting the timed take.
- Do not claim persistent offline cache behavior unless the final dry run
  proves it. The sandbox drops `allow-same-origin`, so cache persistence is
  not the current proof surface.

## 3. 60-90s Take

Follow `.plans/demo-shooting-script.md`. The must-show beats are:

1. Chicken-or-egg hook in the first 7 seconds.
2. Create `Community Garden Grants`.
3. Capture three grant tabs.
4. Attach screenshot for Gemma 4 image input.
5. Add voice memo. If native audio proof is not clean, rely on the local
   transcript path and do not narrate raw audio as proven.
6. Chickens brief appears with title, deadline, eligibility, fit, and why it
   matters.
7. `draft_application_outline` fires.
8. Push to Coop and show the feed.

## 4. Upload and Repo Update

1. Upload the trimmed video to YouTube or Loom.
2. Replace the video placeholder in `README.md` with the actual URL.
3. Paste the same URL into `.plans/kaggle-submission-entry.md`.
4. Run:

```bash
bun run validate smoke
bun run validate:store-readiness
```

## 5. Kaggle Submission

Paste these fields:

- Repo URL:
  `https://github.com/greenpill-dev-guild/coop/tree/feature/hackathon-simplify`
- Video URL: the uploaded YouTube/Loom URL.
- Description: use `.plans/kaggle-submission-entry.md`.

After submitting, save a confirmation screenshot outside the repo or in
`.plans/evidence/` if you want it committed with the final evidence pack.
