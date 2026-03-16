# Testing Workflow — Afo Update Validation

**Purpose:** Validate the Coop extension and PWA after Afo's "ready to go" build phase  
**Tester:** Luiz  
**Timeline:** Next 1-2 weeks

---

## Pre-Flight Checklist

Before testing, ensure:
- [ ] Latest code pulled from `origin/release/0.0`
- [ ] Dependencies installed (`bun install`)
- [ ] Extension built (`bun run --filter @coop/extension build`)
- [ ] Chrome browser ready for unpacked extension loading

---

## Test Environment Setup

### 1. Build Extension
```bash
cd /root/Zettelkasten/03\ Libraries/coop
bun install
bun run --filter @coop/extension build
```

### 2. Load in Chrome (Unpacked)
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked**
4. Select: `packages/extension/dist`
5. Pin the extension (click puzzle icon → pin)
6. Open the sidepanel (click extension icon)

### 3. Start Local Services (for full test)
```bash
# Terminal 1 - App/PWA
bun run dev:app

# Terminal 2 - Signaling server
bun run dev:signaling
```

---

## Core Test Flows

### Flow 1: Extension Basics
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Open sidepanel | Sidepanel loads without errors |
| 1.2 | Check Settings → Nest Runtime | Shows chain, modes, receiver origin |
| 1.3 | Check extension icon states | Idle → Watching → Review Needed transitions work |

### Flow 2: Coop Creation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Create new coop | Setup flow opens |
| 2.2 | Select preset (community/friends/family/project/personal) | Preset-specific copy renders |
| 2.3 | Complete setup ritual | Coop created, state badges update |
| 2.4 | Check Feed tab | Empty state or welcome message shown |

### Flow 3: Peer Join & Sync (Two-Profile Test)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Generate invite (Profile A) | Invite code/link created |
| 3.2 | Join from Profile B | Successfully joins coop |
| 3.3 | Publish item from Profile A | Appears in Profile B's Feed |
| 3.4 | Test sync health | Yjs sync indicator shows connected |

### Flow 4: Receiver PWA Pairing
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Generate receiver pairing (Coops tab) | QR/payload generated |
| 4.2 | Open `/pair` on PWA | Pairing page loads |
| 4.3 | Accept pairing | Success confirmation |
| 4.4 | Capture on `/receiver` | Voice/photo/link captured |
| 4.5 | Check `/inbox` | Item queued or synced |
| 4.6 | Verify in extension intake | Private intake receives item |

### Flow 5: Capture → Review → Publish
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Run Manual Round-up | Tabs captured as drafts |
| 5.2 | Open Roost | Drafts visible for review |
| 5.3 | Edit a draft | Changes save correctly |
| 5.4 | Publish to coop | Appears in Feed |
| 5.5 | Check board route | Published on `/board/<coop-id>` |

### Flow 6: Archive & Export
| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Archive snapshot | Archive created successfully |
| 6.2 | Export receipt | Download works or file picker opens |
| 6.3 | Verify receipt contents | Legible archive receipt |

---

## Issue Reporting Template

When you find bugs or UX friction, create issues with:

```markdown
**Component:** [extension | pwa | sync | ui]
**Severity:** [blocker | major | minor | polish]
**Steps to Reproduce:**
1. ...
2. ...

**Expected:** ...
**Actual:** ...

**Environment:**
- Chrome version: ...
- Extension mode: [dev unpacked | chrome store]
- Onchain mode: [mock | live]
- Archive mode: [mock | live]

**Screenshots/Logs:** [attach if relevant]
```

---

## Known Areas to Watch

Based on Afo's update, pay special attention to:

1. **CUI Polish** — Conversational flows should feel smooth
2. **File Calling Architecture** — File handling should be reliable
3. **Extension State Transitions** — Icon states (idle/watching/review/error) should map correctly
4. **Multi-coop UX** — Switching between coops should be clear
5. **Error Recovery** — Failures should surface actionable messages

---

## Quick Regression Checklist

Before filing any "it doesn't work" issue, verify:
- [ ] Extension was reloaded after build (`chrome://extensions` → reload icon)
- [ ] Correct `.env.local` configuration
- [ ] Signaling server running (if testing sync)
- [ ] Both profiles using compatible versions
- [ ] No conflicting extensions interfering

---

## Sign-off Criteria

Testing phase complete when:
- [ ] All 6 core flows pass without blockers
- [ ] Issue list created with severity classifications
- [ ] Feedback on website/PWA UX documented
- [ ] Afo has acknowledged issues for iteration

---

## Reference

- [Demo & Deploy Runbook](./demo-and-deploy-runbook.md)
- [Extension Install & Distribution](./extension-install-and-distribution.md)
- [Testing & Validation](./testing-and-validation.md)
- [Coop Docs Site](https://coop-docs-delta.vercel.app/)
