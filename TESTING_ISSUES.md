# Coop Testing Issues & Findings

**Testing Session Start:** 2026-03-16  
**Tester:** Luiz  
**Status:** In Progress  
**Target:** 6 core flows (extension basics → archive/export)

---

## Issue Template

When you find bugs or UX friction, copy this template and fill it in:

```markdown
### [Issue #] – [Title]

**Component:** [extension | pwa | sync | ui | other]  
**Severity:** [blocker | major | minor | polish]  
**Status:** [new | in-progress | fixed | deferred]

#### Steps to Reproduce
1. ...
2. ...

#### Expected
...

#### Actual
...

#### Environment
- Chrome version: [your version]
- Extension mode: [dev unpacked | chrome store]
- Onchain mode: [mock | live]
- Archive mode: [mock | live]
- Signaling: [local | production]

#### Screenshots/Logs
[Attach if relevant]

#### Notes
...
```

---

## Issues Found

### [No issues recorded yet]

---

## Test Flow Progress

| Flow | Status | Notes |
|------|--------|-------|
| 1. Extension Basics | ⬜ Pending | Settings, state transitions, icon states |
| 2. Coop Creation | ⬜ Pending | Setup flow, presets, ritual completion |
| 3. Peer Join & Sync | ⬜ Pending | Two-profile, Yjs sync health |
| 4. Receiver PWA Pairing | ⬜ Pending | QR generation, pairing, capture intake |
| 5. Capture → Review → Publish | ⬜ Pending | Full loop, board rendering |
| 6. Archive & Export | ⬜ Pending | Snapshot creation, receipt export |

---

## Quick Checklist

Before filing each issue, verify:
- [ ] Extension was reloaded after build (`chrome://extensions` → reload icon)
- [ ] Correct `.env.local` configuration
- [ ] Signaling server running (if testing sync)
- [ ] Both profiles using compatible versions
- [ ] No conflicting extensions interfering

---

## Sign-Off Criteria

Testing phase complete when:
- [ ] All 6 core flows pass without blockers
- [ ] Issue list complete with severity classifications
- [ ] Feedback on website/PWA UX documented
- [ ] Afo has acknowledged issues for iteration

---

**Last Updated:** 2026-03-16 12:49 UTC
