---
name: status
user-invocable: true
description: Morning briefing — architecture state, feature pipeline, production health, user journeys, git pulse, and daily focus recommendations. Not an audit; a lay of the land.
argument-hint: "[--quick|--full] [--focus pipeline|health|journeys|git|agent]"
version: "1.1.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-07"
last_verified: "2026-04-07"
---

# Status Skill

Situational awareness briefing for starting a work session. Aggregates architecture state, feature pipeline progress, production health signals, user journey readiness, git activity, and recommends what to focus on.

**This is NOT an audit.** It does not look for problems to fix. It maps the terrain so you can navigate it.

---

## Invocation

```
/status                    # Standard briefing (all sections)
/status --quick            # Abbreviated — pipeline + health + focus only
/status --full             # Deep briefing with subagent exploration
/status --focus pipeline   # Feature pipeline only
/status --focus health     # Production health only
/status --focus journeys   # User journey readiness only
/status --focus git        # Git activity pulse only
/status --focus agent      # Agent & skill ecosystem only
```

---

## Execution Model

- **Read-only**: Never edit files. All output goes to chat.
- **Speed over depth**: Favor fast reads over exhaustive scans. This runs at session start — keep it under 2 minutes for standard, 30 seconds for `--quick`.
- **Parallel gathering**: Sections 1-6 can be gathered in parallel. The Headline, Blockers, Delta, and Daily Focus synthesize the others.
- **For `--full` mode**: Use Explore subagents for deeper architecture and journey mapping. Standard mode uses direct tool calls only.
- **Wait gate for `--full` mode**: When subagents are spawned, they MUST run in foreground (NOT `run_in_background`). Do NOT render the briefing until all subagent results have returned. Incorrect early output with later corrections is worse than a slower correct output.

---

## Output Structure

The briefing always follows this order:

1. **Headline** — one-sentence state of the product (synthesized after gathering)
2. **Blockers** — anything blocking work, pulled to the top (if any exist)
3. **Last Session** — continuity from `session-state.md` (if it exists)
4. **Delta** — what changed since last `/status` run (if prior data exists)
5. Sections 1-6 (data)
6. Section 7: Daily Focus (synthesis)

---

## Headline

A single sentence at the very top summarizing the product state. Written after all sections are gathered. Should be scannable in under 3 seconds.

### Format

```
> **[N/M journeys operational]. [N features in progress, N dormant]. [Health signal]. [Agent pipeline signal].**
```

This is a template — fill from gathered data. Never reuse example values verbatim.

### Rules

- One sentence, max two. No bullet points.
- Cover: which journeys work, what's mock/broken, pipeline momentum, health signal.
- Use plain language — this is for a human glancing at their terminal first thing in the morning.

---

## Blockers Callout

If ANY of the following are true, surface them in a prominent callout block before the sections. Nothing buried = nothing missed.

### Sources

- Lanes with status `blocked` in any feature pack
- Failing health checks (types, lint, tests)
- Broken user journeys (`✗` status)
- Stale dependencies blocking a feature
- Uncommitted work on a branch that's diverged significantly

### Output

```
> **⚠ Blockers**
> - **autoresearch/ui** lane blocked — waiting on runtime merge
> - **Tests FAIL** — 2 regressions since last run
> - **Capture (media)** journey broken — receiver handler missing
```

If nothing is blocked, omit this section entirely. Don't say "No blockers" — absence means clear.

---

## Last Session

If `session-state.md` exists in the repo root, read it and surface a continuity summary.

### Gather

1. Check if `session-state.md` exists at repo root
2. If yes, read it and extract: current task, progress, files modified, next steps, blockers

### Output

```
> **Continuing from last session** (saved 2026-04-06T23:15:00Z)
> Task: Autoresearch QA pass 2
> Left off: experiment-loop tests passing, variant-generation untested
> Next: Wire variant UI into Nest tab settings
```

If no `session-state.md` exists, omit this section. Don't mention its absence.

---

## Delta (Change Since Last Status)

Track what moved between status runs. This turns the briefing from a snapshot into a momentum tracker.

### Gather

After all sections are gathered, compare current values against the previous run's data. The previous run's data comes from:
1. The most recent `/status` output in conversation history (same session)
2. Or absence — if this is the first run, skip this section

### Output

```
> **Since last status** (2h ago)
> - Tests: 47 → 52 (+5)
> - Skills with eval: 3 → 5 (+2)
> - Branches: -2 merged, +1 new
> - Features: agent-knowledge-sandbox moved planned → in-progress
> - Health: all checks still passing
```

### Rules

- Only show lines where something changed. Don't repeat stable values.
- If this is the first `/status` in the session, omit this section entirely.
- Use `→` arrows for transitions, `+N`/`-N` for numeric changes.

---

## Freshness Indicators

All dates in the briefing should use relative age labels instead of (or alongside) absolute dates. This makes staleness immediately visible.

### Age Labels

| Age | Label | Urgency |
|-----|-------|---------|
| Today | `today` | Current |
| 1 day | `yesterday` | Current |
| 2-6 days | `Nd ago` | Normal |
| 7-13 days | `~Nw ago` | Attention |
| 14+ days | `Nd ago ⚠ stale` | Stale — flag it |

### Application

Use these everywhere dates appear:
- Feature pipeline `Updated:` field → `Updated: today` or `Updated: 12d ago ⚠ stale`
- Git pulse timestamps
- Session state saved date
- Build staleness

---

## Section 1: Architecture Snapshot

Quick structural overview — not a deep analysis (that's `/architecture`).

### Gather

1. Read `packages/*/package.json` — extract name, version, key dependency versions
2. Count shared modules: `ls packages/shared/src/modules/`
3. Count extension views: `ls packages/extension/src/views/`
4. Count skills: `ls packages/extension/src/skills/`
5. Check `@coop/shared` barrel: count exports in `packages/shared/src/index.ts`

### Output

```
## Architecture Snapshot

| Package | Version | Key Deps |
|---------|---------|----------|
| @coop/shared | x.x.x | viem, yjs, dexie, zod |
| @coop/app | x.x.x | react, vite |
| @coop/extension | x.x.x | wxt, react, webllm |
| @coop/api | x.x.x | hono, bun |

Shared modules: N  |  Extension views: N  |  Agent skills: N
Shared barrel exports: ~N
```

---

## Section 2: Feature Pipeline

The heart of the briefing. Read all feature packs and present where everything stands.

### Gather

1. Read every `.plans/features/*/status.json` that exists
2. For features without `status.json`, read the `spec.md` header to infer stage
3. Check for any `.plans/*.todo.md` flat files (legacy)
4. Read `.plans/features/*/lanes/*.todo.md` frontmatter for lane-level status

### Classification

Group features by lifecycle stage:

| Stage | Criteria |
|-------|----------|
| **Shipped** | All lanes `done`, merged to main |
| **In Progress** | At least one lane `in_progress` or `done` with others remaining |
| **Ready** | All lanes `todo` or `ready`, no blockers |
| **Planned** | Has spec but lanes not started |
| **Blocked** | Has explicit blockers or unresolved dependencies |
| **Dormant** | No `status.json`, `updated_at` > 14 days old |

### Output

```
## Feature Pipeline

### In Progress
- **autoresearch** — Self-optimizing agent skills
  Lanes: eval ✓ | state ✓ | runtime ✓ | ui ✓ | qa1 ✓ | qa2 ✓
  Updated: today

### Planned
- **agent-knowledge-sandbox** — Curated sources + graph memory
  Lanes: eval → | state → | runtime → | ui →
  Updated: yesterday

### Dormant
- **media-compression-sharing** — 12d ago ⚠ stale
- **receiver-design-polish** — 12d ago ⚠ stale

Total: N features (N shipped, N in progress, N planned, N dormant)
```

Use lane indicators: `✓` done, `◐` in progress, `→` ready/todo, `✗` blocked, `—` n/a

---

## Section 3: Production Health

Quick signals — not a full monitor run (that's `/monitor`).

### Gather

1. Run `bun run validate typecheck 2>&1 | tail -5` — pass/fail
2. Run `bun lint 2>&1 | tail -5` — pass/fail + warning count
3. Run `bun run test 2>&1 | tail -15` — test count, pass/fail summary
4. Check last successful build: `git log --oneline --grep='build' -5` or check if `dist/` dirs exist
5. Check environment: read `.env.local` for current mode settings (mock/live)

### Output

```
## Production Health

| Check | Status | Detail |
|-------|--------|--------|
| Types | PASS | 0 errors |
| Lint | PASS | 2 warnings |
| Tests | PASS | 47/47 |
| Build | STALE | Last build: 2 days ago |

Environment: sepolia / mock onchain / mock archive
```

Statuses: `PASS`, `WARN` (non-blocking issues), `FAIL` (blocking), `STALE` (not recently verified), `UNKNOWN`

---

## Section 4: User Journey Map

Which product flows are wired and operational vs stubbed or incomplete.

### Gather

For each journey, read the **sentinel file(s)** listed below. A journey is `● Operational` if the sentinel contains real logic (function bodies, API calls, crypto, protocol handling). It is `◐ Partial` only if the sentinel exists but contains TODOs, empty stubs, or placeholder returns. It is `○ Mock` only if the implementation is a mock/fake that returns hardcoded data. It is `✗ Broken` if the file is missing or has import/compile errors. **Do not infer status from config mode toggles** — a real implementation behind a mock-mode flag is still `● Operational`.

| # | Journey | Sentinel file(s) | Look for |
|---|---------|-------------------|----------|
| 1 | Capture (tabs) | `extension/src/background/handlers/capture.ts` | `extractPageSnapshot`, `savePageExtract` |
| 2 | Capture (media) | `app/src/views/Receiver/CaptureView.tsx` | `getUserMedia`, `MediaRecorder`, `onPickFile` |
| 3 | Refine (agent) | `extension/src/runtime/agent/index.ts`, `extension/src/runtime/skills/runner.ts` | `handleRunAgentCycle`, skill registry, WebLLM bridge |
| 4 | Review | `extension/src/views/Sidepanel/tabs/ChickensTab.tsx` | Draft cards, approve/reject, `useDraftEditor` |
| 5 | Share (local sync) | `shared/src/modules/storage/index.ts`, grep for `y-webrtc` or `connectReceiverSyncProviders` | Yjs doc creation, provider wiring, peer transport |
| 6 | Share (archive) | `shared/src/modules/archive/index.ts` | `uploadArchiveBundle`, `createStorachaArchiveClient`, UCAN delegation |
| 7 | Auth (passkey) | `shared/src/modules/auth/index.ts` | `createWebAuthnCredential`, `restorePasskeyAccount` |
| 8 | Auth (Safe) | `shared/src/modules/onchain/index.ts` | `createSmartAccountClient`, Safe v1.4.1, ERC-7579 |
| 9 | Sync (signaling) | `api/src/ws/` or `api/src/index.ts` | WebSocket upgrade, room management, awareness protocol |

All sentinel paths are relative to `packages/`. In standard mode, read the first 50 lines of each sentinel. In `--full` mode, the Explore subagent does deeper analysis.

### Output

```
## User Journeys

| Journey | Status | Notes |
|---------|--------|-------|
| Capture (tabs) | [indicator] | [evidence from sentinel read] |
| Capture (media) | [indicator] | [evidence from sentinel read] |
| ... | ... | ... |
```

Indicators: `●` operational, `◐` partial/WIP, `○` mock/stubbed, `✗` broken/missing

**Never copy example statuses from this skill definition.** Every status must come from reading the actual sentinel files.

---

## Section 5: Git Activity Pulse

Recent activity context to understand momentum and open work.

### Gather

1. `git log --oneline -20` — recent commits
2. `git branch -a --sort=-committerdate | head -15` — active branches
3. `git status` — uncommitted work
4. `git stash list` — stashed work
5. `git log --since='7 days ago' --format='%an' | sort | uniq -c | sort -rn` — contributor activity

### Output

```
## Git Pulse

Last 7 days: N commits across N branches
Active branches: feature/xxx, fix/yyy, ...
Uncommitted changes: N files modified, N untracked

Recent commits:
  bdb2c88 docs(agent): define avenger stack and Coop OS architecture
  d5b5155 chore(claude): add orchestration plan
  ...
```

---

## Section 6: Agent & Skill Ecosystem

The agent pipeline is the product. This section surfaces whether the AI layer is healthy.

### Gather

1. **Skill inventory**: `ls packages/extension/src/skills/` — count skill directories, note any with missing `system.md` or empty `eval/` dirs
2. **Eval fixture health**: `find packages/extension/src/skills/*/eval -name '*.json' | wc -l` — how many eval fixtures exist
3. **Agent runtime**: Read `packages/extension/src/runtime/agent/index.ts` header — check for exported entry points, note any TODO/FIXME markers
4. **Autoresearch state**: Read `.plans/features/autoresearch/status.json` — are experiments running, what's the latest variant status
5. **Skill schema contracts**: Check `packages/shared/src/contracts/schema-agent.ts` for skill-related schemas — count how many are defined
6. **Inference cascade**: Check `packages/extension/src/runtime/agent/experiment-loop.ts` — is the loop wired and exported
7. **WebLLM readiness**: Grep for WebLLM imports/model references to confirm model availability

### Output

```
## Agent & Skill Ecosystem

| Metric | Value |
|--------|-------|
| Skills registered | N |
| Skills with eval fixtures | N / N |
| Agent schemas defined | N |
| Experiment loop | wired / not wired |
| Autoresearch | active / dormant / not started |

### Skill Detail
| Skill | Has system.md | Has eval | Eval fixtures |
|-------|:------------:|:--------:|:-------------:|
| capital-formation-brief | ● | ● | 2 |
| memory-insight-synthesizer | ● | ● | 2 |
| review-dig | ● | ○ | 0 |
| ... | ... | ... | ... |

### Agent Pipeline
- Inference cascade: [wired/partial/missing]
- Variant generation: [active/dormant]
- Last experiment: [date or "none"]
```

Indicators: `●` present, `○` missing

---

## Section 7: Daily Focus

Synthesize sections 1-6 into actionable recommendations for the work session.

### Logic

1. **Blocked features** → Unblock first (highest leverage)
2. **In-progress features with ready lanes** → Continue momentum
3. **Failing health checks** → Fix before new work
4. **Skills missing eval fixtures** → Strengthen the agent pipeline
5. **Stale builds** → Rebuild to establish baseline
6. **Dormant features** → Decide: continue, defer, or archive
7. **Ready features** → Pick one to start if nothing else is pressing

### Output

```
## Daily Focus

### Priority
1. **[Action]** — [reason, context]
2. **[Action]** — [reason, context]
3. **[Action]** — [reason, context]

### Consider
- [Lower-priority suggestion]
- [Lower-priority suggestion]

### Parking Lot
- [Dormant items that need a decision but aren't urgent]
```

Keep to 3 priority items max. Be specific about what to do, not vague.

---

## Mode Variants

### `--quick`

Run only:
- Headline (always)
- Blockers callout (if any)
- Last Session (if `session-state.md` exists)
- Section 2 (Feature Pipeline) — abbreviated, no lane detail
- Section 3 (Production Health) — typecheck only, skip full test run
- Section 7 (Daily Focus) — based on available data

Target: under 30 seconds.

### `--full`

All sections plus:
- Spawn **foreground** Explore subagents (never background) to map shared module export surface and check user journey wiring depth
- Do NOT render any briefing output until all subagents have returned their results
- Include dependency version audit (outdated packages)
- Include a "What's Changed Since Last Status" diff if a previous status output is found
- Target: under 3 minutes (slower than standard, but correct on first pass)

### `--focus [section]`

Run only the named section:
- `pipeline` → Section 2
- `health` → Section 3
- `journeys` → Section 4
- `git` → Section 5
- `agent` → Section 6

---

## Output Format

Always output as chat markdown. The briefing should be scannable — use tables, indicators, and short sentences. No prose paragraphs.

### Header

```
# Coop Status — [date]

> **[Headline — one sentence product state summary]**
```

Immediately followed by Blockers callout (if any), Last Session (if exists), Delta (if not first run), then sections 1-7.

### Footer

```
---
_Briefing generated [timestamp]. For deeper analysis: `/architecture`, `/audit`, `/monitor`._
```

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| List every file or export | This is a briefing, not an inventory |
| Flag issues to fix | This is not an audit — observe, don't prescribe fixes |
| Run full test suite in `--quick` mode | Speed matters at session start |
| Make architectural judgments | Describe the state, don't evaluate it |
| Edit any files | Read-only, always |
| Recommend refactoring | That's `/architecture` territory |
| Spend more than 2 minutes | If gathering takes too long, report what you have |

---

## Execution Checklist

When `/status` is invoked:

1. Parse arguments for mode (`--quick`, `--full`, `--focus`)
2. **Check for `session-state.md`** at repo root — read if present
3. **Gather in parallel** (sections 1-6 as independent data collection)
   - For standard mode: direct tool calls (Read, Bash, Glob, Grep). For Section 4 (Journeys), read the sentinel files specified in the gather table.
   - For `--full` mode: spawn Explore subagents for sections 1, 4, and 6. **Subagents MUST run in foreground** (do NOT use `run_in_background`). The briefing cannot render until all subagents return.
   - Health checks (Section 3) can run as background tasks since they're slow, but MUST complete before rendering.
4. **WAIT GATE**: Confirm ALL gather tasks (including subagents and background commands) have returned results before proceeding. Never render with assumed/guessed data.
5. **Synthesize post-gather elements** from gathered data:
   - Write the **Headline** (one sentence)
   - Extract **Blockers** from all sections (blocked lanes, failing checks, broken journeys)
   - Compute **Delta** if prior `/status` data exists in conversation
   - Compose **Section 7: Daily Focus**
6. **Format** the briefing in output order: Headline → Blockers → Last Session → Delta → Sections 1-6 → Daily Focus
7. **Use freshness labels** for all dates (today / yesterday / Nd ago / Nd ago ⚠ stale)
8. **Output** the complete briefing — one pass, no corrections afterward

---

## Related Skills

- `/architecture` — Deep structural analysis (when status reveals architecture questions)
- `/audit` — Problem-finding mode (when status reveals health issues)
- `/monitor` — Continuous quality watching (when status shows failing checks)
- `/plan` — Feature planning (when status shows ready features to start)
- `/debug` — Investigation (when status shows broken journeys)
