# Manual testing + Cursor session log

Use this note alongside `TESTING_MASTER_GUIDE_2026-03-30.md` and `TESTING_START_HERE_2026-03-30.md`. It does not replace those guides.

## Two tracks

| Track | Role |
|--------|------|
| **Other session / automated** | Validation, E2E, or agent-driven checks — separate report. |
| **You + this chat** | Manual steps in a real browser; **this Cursor thread** is the live log (pass/fail, env, blockers). Optionally copy summaries into `TESTING_SESSION_2026-03-30.md` or `TESTING_ISSUES.md`. |

## What to paste here (examples)

```text
[local time] Test 1.2 — PASS — Chrome — scroll OK
[local time] Test 2.3 — FAIL — popup console: …
```

Include when useful: browser + version, viewport, mock vs live from `.env.local`.

## Optional: mirror into repo

Paste or append the same lines under **Log** below if you want a git-tracked copy.

---

## Log

| Time (local) | Test ID | Result | Notes |
|--------------|---------|--------|-------|
| 2026-03-31 | 1.2 | Partial / issues | Scroll animations sluggish; `#why-build` chickens piled top-left; team block late, small avatars, overlapping names |
| 2026-03-31 | 1.3 | Issues | Flashcard top lines off; remove `flashcard-action-mark` dots; lens vs ritual copy inconsistency |
| 2026-03-31 | — | Enhancement | Request: add new rituals beyond fixed four |

---

## Issues (short index)

Full write-ups: `TESTING_SESSION_2026-03-30.md` — **Issues #4–#9** (manual 2026-03-31).

| # | Test ID | Title | Severity |
|---|---------|-------|----------|
| 4 | 1.2 | Scroll animations sluggish | Medium |
| 5 | 1.3 | Flashcard lines off; remove bottom decorative marks | Low |
| 6 | 1.3 | Lens vs ritual naming inconsistent | Low |
| 7 | — | Add new rituals (feature) | Low |
| 8 | 1.2 | Chickens wrong in `#why-build` | Medium |
| 9 | 1.2 | Team section: late animation, overlap, small avatars | Medium |

---

## Reconcile with automated run

When the other session finishes: dedupe issues, note **manual** vs **automated** for the same root cause.
