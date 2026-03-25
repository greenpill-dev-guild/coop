# Agentic Interface Architecture

> How Coop's agent communicates with the user through the UI.

## Current Architecture

Coop's agent operates as a 16-skill pipeline in the MV3 background service worker:

```
Observe → Plan → Execute → Record
```

1. **Observe**: Capture events (tab roundup, audio transcript, heartbeat) create `AgentObservation` records in Dexie
2. **Plan**: The agent cycle selects skills for each observation, builds an `AgentPlan`
3. **Execute**: Skills run via a 3-tier inference cascade (heuristic → WebLLM → cloud fallback), producing `SkillRun` records with validated outputs
4. **Record**: Outputs become `ReviewDraft` entries, `ActionProposal` bundles, or `AgentMemory` records

The agent is governed by the coop's constitutional values (`coop.soul`) and operates within graduated authority tiers (Safe multisig → session keys → member accounts).

## The Notification Gap (Pre-AG-UI)

Before the AG-UI event channel, the agent worked **silently**. Users had to navigate to the Operator Console (Nest → Agent sub-tab) to discover what the agent had done. The only background→UI communication was a generic `DASHBOARD_UPDATED` message that triggered a full dashboard re-fetch — no granularity, no lifecycle visibility.

This meant:
- A user clicking "Roundup Chickens" had no feedback until they manually checked the Chickens tab
- Whisper transcription completed without any notification
- Agent cycles started and finished invisibly
- Proactive roundups produced drafts that sat undiscovered

## AG-UI Event Channel

Inspired by the [AG-UI (Agent-User Interaction Protocol)](https://docs.ag-ui.com), Coop now emits typed lifecycle events from the agent to any open popup or sidepanel.

### Event Types

| Event | AG-UI Analog | Emitted From | Purpose |
|-------|-------------|-------------|---------|
| `AGENT_CYCLE_STARTED` | `RunStarted` | `agent-runner.ts` | Agent began processing observations |
| `AGENT_CYCLE_FINISHED` | `RunFinished` | `agent-runner.ts` | Cycle complete with metrics |
| `AGENT_STATE_DELTA` | `StateDelta` | `agent.ts:notifyProactiveDelta()` | New drafts/actions/digests produced |
| `AGENT_CYCLE_ERROR` | `RunError` | `agent-runner.ts` | Cycle caught a top-level error |

### Transport

Events use the same `chrome.runtime.sendMessage` channel as `DASHBOARD_UPDATED`. The `BackgroundNotification` union type discriminates between dashboard updates and agent events. The `notifyAgentEvent()` helper is fire-and-forget with "Receiving end does not exist" suppression.

### Consumption

**Popup** (`usePopupDashboard.ts`):
- Listens via `chrome.runtime.onMessage.addListener`
- `AGENT_STATE_DELTA` → displayed as a 4-second auto-dismiss toast (same mechanism as capture feedback)
- Staleness guard: ignores events older than 30 seconds or received within 500ms of mount

**Sidepanel** (`useDashboard.ts`):
- Extends the existing `DASHBOARD_UPDATED` listener
- `AGENT_CYCLE_STARTED/FINISHED` → toggles `agentRunning` boolean (future spinner UI)
- `AGENT_STATE_DELTA` → exposed as `agentDelta` for Operator Console display

### Design Decisions

1. **Extend existing channel, not a new one** — reuses the proven `chrome.runtime.sendMessage` transport
2. **4 event types only** — maps to the actual notification gap; AG-UI's text-message, tool-call, and reasoning events aren't needed yet
3. **Fire-and-forget** — if no listener is open, events are silently dropped; the popup re-fetches on open anyway
4. **Human-readable message** — `AGENT_STATE_DELTA` includes a pre-formatted `message` string so the popup doesn't need to build sentences from counts

## Domain-Registered UI Sections

The NestTab decomposition created **addressable domain sections** — UI surfaces the agent can target:

| Section | Domain | What It Renders |
|---------|--------|-----------------|
| `NestAgentSection` | Agent | Operator Console: plans, skill runs, policies, action queue |
| `NestArchiveSection` | Archive | Snapshot/artifact archiving, IPFS receipts |
| `NestSettingsSection` | Settings | Sound, inference, capture preferences |
| `NestInviteSection` | Membership | Invite codes, member management |
| `NestReceiverSection` | Receiver | Device pairing, cross-device sync |

Each section receives the full `SidepanelOrchestration` state and destructures what it needs — matching the popup's proven pattern where each screen selects its own props.

### "Landing Zone Density"

Component decomposition for agent development is about creating **surfaces where an AI agent can land**. Agents can target a specific composed module (178-line `NestAgentSection`) but can't target a section of a monolith (954-line `NestTab`). The action-executors split (1,237 → 5 domain files of 45-260 lines) follows the same principle: each domain file is an independently addressable landing zone.

## Future: AG-UI Evolution

The current implementation covers AG-UI's lifecycle and state-delta event categories. Future phases could add:

- **Suggestions** (`Custom` events): Agent proposes navigation actions — "3 funding leads found for Watershed Coop, review?" — rendered as tappable NotificationBanners
- **Tool calls** (`ToolCallStart/End`): Agent invokes UI-side actions — navigate to a draft, highlight a card, switch coop context
- **Generative UI**: Agent specifies which component to render (static tier of CopilotKit's generative UI pattern)

These align with the [Agent OS roadmap](./agent-os-roadmap.md) Phase 3A (dispatcher refactor) which calls for routing agent outputs to appropriate UI surfaces.

## Dream UX: The Capture-to-Coordination Conversation

*From the March 24 dream journal, Cycle 5:*

> You open Chrome with 23 tabs from last night's research. You click the Coop extension icon. The popup opens in ~100ms. You tap "Roundup Chickens."
>
> 12 seconds later, an agent event pushes a banner: "Found 3 funding leads and 1 opportunity for Watershed Coop." You tap it. The popup navigates to Chickens, filtered to Watershed Coop. Three draft cards pulse gently.
>
> You tap the EPA grant draft. Title, summary, next step. One button: "Share to Watershed Coop." You press it. The artifact propagates via Yjs.
>
> **Total time: 40 seconds from popup open to shared knowledge.**

This is the vision the AG-UI event channel enables — the agent and user co-navigating knowledge, not the user checking on a silent background process.
