---
name: debug
description: Debugging & Troubleshooting - systematic root cause investigation with hypothesis testing and evidence collection. Use when the user reports a bug, encounters an error, sees unexpected behavior, or says 'debug this' or 'investigate this issue'.
argument-hint: "[error-description]"
version: "1.0.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Debug Skill

Systematic debugging: find root causes before fixes, verify with evidence before completion.

**References**: See `CLAUDE.md` for codebase patterns.

---

## Activation

| Trigger | Action |
|---------|--------|
| `/debug` | Start root cause investigation |
| `/debug --mode incident_hotfix` | Emergency stabilization with minimal fixes |
| `/debug --mode tdd_bugfix` | Test-first bugfix loop |
| Tests failing | Systematic debugging |
| Build failures | Trace and fix |
| Verifying completion | Evidence-based checks |

## Progress Tracking (REQUIRED)

Use **TodoWrite** when available. If unavailable, keep a Markdown checklist in the response. See `CLAUDE.md` -> Session Continuity.

---

## Safety Rules

- Non-destructive recovery only
- Save a patch snapshot before risky edits: `git diff > /tmp/coop-debug.patch`
- Use a safety branch for experiments: `git switch -c debug/incident-$(date +%Y%m%d-%H%M%S)`
- Never use destructive reset/reclone patterns in debug flow

## Core Principle

> ALWAYS find root cause before attempting fixes.
> Evidence before claims, always.

---

## Part 1: Root Cause Investigation

### Phase 1: Gather Evidence

**DO NOT attempt any fixes yet.**

1. **Read error messages thoroughly**
2. **Reproduce consistently** — exact steps
3. **Check recent changes**: `git log --oneline -20`
4. **Trace data flow backward** — where does error manifest?

### Phase 2: Hypothesis Testing

1. **Form specific hypothesis**
   - "Error occurs because X calls Y with null"
   - NOT "Something is wrong with the API"

2. **Test minimally** — ONE variable at a time

3. **If 3+ fixes fail: STOP**
   - Question the architecture
   - Reassess understanding
   - Ask for help

---

## Part 2: Escalation

| Fix Type | Criteria | Action |
|----------|----------|--------|
| **Simple** | <10 lines, single file | Fix directly |
| **Complex** | >10 lines, multi-file, needs tests | Use TDD bugfix flow |
| **Architectural** | Pattern change, refactor | TDD + /plan |

### Handoff Format

```markdown
## Debug Handoff

### Root Cause
[What you found]

### Location
[File:line where issue originates]

### Evidence
[Commands/logs that prove the cause]

### Suggested Fix
[Your recommendation]
```

---

## Part 3: Verification Before Completion

### Mandatory Verification

| Claim | Command |
|-------|---------|
| "Tests pass" | `bun run test` (NOT `bun test` -- see CLAUDE.md) |
| "Build succeeds" | `bun build` |
| "Linting clean" | `bun lint` |

### Suspicious Language

If you say these, STOP and verify first:
- "should work"
- "I think"
- "probably"
- "seems to"

---

## Part 4: Coop Debugging

### Local-First / Sync Issues
- Check Dexie for stuck or corrupted records
- IndexedDB: Chrome DevTools > Application > IndexedDB
- Yjs document state: inspect Y.Doc in console
- y-webrtc signaling: check if API server is running (`bun dev:api`)
- Peer discovery: check WebRTC connection state in console

### Extension Issues

```bash
# Check extension build output
cd packages/extension && bun build

# Reload extension in Chrome
# chrome://extensions > Developer mode > Reload

# Background worker logs
# chrome://extensions > "Inspect views: service worker"

# Content script logs
# Regular DevTools console on the page
```

### App / PWA Issues

```bash
# Check app build
cd packages/app && bun build

# Service Worker registration: Chrome DevTools > Application > Service Workers

# Check Vite dev server
cd packages/app && bun dev
```

### Build & Type Debugging

```bash
# TypeScript errors without emitting
cd packages/shared && npx tsc --noEmit

# Check specific package types
cd packages/app && npx tsc --noEmit

# Vite build with verbose output
cd packages/app && DEBUG=vite:* bun build
```

### Onchain Issues

```bash
# Check Safe deployment status
# Use the validate script
bun run validate:arbitrum-safe-live

# Check chain connectivity
bun run probe:onchain-live
```

### Common Debug Scenarios

| Symptom | Likely Cause | Diagnostic |
|---------|-------------|------------|
| Stale data after publish | Yjs sync not propagating | Check y-webrtc peer connections |
| Extension popup blank | Build error or manifest issue | Check chrome://extensions errors |
| Passkey auth fails | WebAuthn API issue | Check browser console for DOMException |
| Dexie version error | Schema migration mismatch | Check Dexie.version() calls |
| Background worker crash | Unhandled promise rejection | Inspect service worker in chrome://extensions |
| Receiver not pairing | API server down | Check `bun dev:api` output |

---

## Part 5: Cross-Layer Debugging

For tracing issues through the full local -> sync -> publish pipeline:

### Coop Data Pipeline

```
Local Draft -> Dexie -> Yjs Doc -> y-webrtc Sync -> Publish -> Archive (Storacha)
```

### Step-by-Step Trace

#### Layer 1: Local Storage (Dexie)
```bash
# Check IndexedDB for stuck records
# Chrome DevTools > Application > IndexedDB

# Check Dexie table state in console
# db.table('flows').toArray().then(console.log)
```

| Symptom | Layer | Check |
|---------|-------|-------|
| Draft not saving | Dexie | Storage quota: `navigator.storage.estimate()` |
| Data missing after refresh | Dexie | Check if table/version exists |
| Schema error on open | Dexie | Version migration mismatch |

#### Layer 2: Yjs Sync
```bash
# Check Y.Doc state
# In console: ydoc.getMap('flows').toJSON()

# Monitor sync events
# awareness.on('change', console.log)
```

#### Layer 3: Archive (Storacha)
```bash
# Check if content was archived
# Look for CID in Storacha responses in Network tab

# Verify CID is retrievable
node -e 'fetch("https://w3s.link/ipfs/<CID>").then(r => console.log(r.status))'
```

#### Layer 4: Onchain
```bash
# Check Safe transaction status
bun run validate:arbitrum-safe-live
```

---

## Three-Strike Protocol

After 3 failed fixes:
1. **STOP fixing**
2. **Document what you tried**
3. **Question assumptions**
4. **Consider alternatives**

---

## Output

After debugging provide:

### Summary
- Symptom and scope
- Mode used

### Root Cause
- Evidence-backed cause statement

### Actions
- Fix applied (or recommended if report-only)

### Verification
- Commands executed and outcomes

### Next Step
- `DONE`, `NEEDS_INPUT`, or `ESCALATE`

## Anti-Patterns

- **Guessing without reproduction** — never change code before reproducing the issue
- **Using destructive recovery commands** — avoid `git checkout -- .`, repo deletion, and forced resets in debug workflows
- **Claiming success without evidence** — always attach commands and outputs for build/test verification
- **Skipping dependency order checks** — shared/app/extension drift can hide root cause

## Related Skills

- `error-handling-patterns` — Error categorization and handling strategies
- `testing` — Writing regression tests after fixing bugs
