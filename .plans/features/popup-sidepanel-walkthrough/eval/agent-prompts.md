# Popup + Side Panel Walkthrough Agent Prompts

These prompts are designed to be run one by one. Some original issues have been grouped into single prompts where they share the same write surface. That reduces collisions and makes the shared session state more useful.

## Shared Preamble For Every Prompt

Use this at the top of every agent prompt:

```text
Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Workflow:
1. Read the full session state file.
2. Add a Task Log entry for this task with status `in_progress`, expected files, touched surfaces, and regression watchouts.
3. Review all prior Task Log entries for any shared surfaces you will touch.
4. Make the change without reverting prior fixes.
5. Update your Task Log entry with files touched, behavior changes, validation run, regressions checked, and follow-up notes for the next agent.

Non-regression guardrails:
- Do not reintroduce inline notifications that push popup or side panel layout.
- Do not bring back coop-specific copy in pre-review capture flows.
- Keep popup and side panel dialog layouts within known width constraints.
- If you change shared behavior, document the new rule in the session state file before you finish.
```

## Prompt 1: Notification System Normalization

```text
Task slug: notifications-normalization

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Audit and normalize notification behavior across popup and side panel. Current status and error messages are being rendered inline, pushing content down, creating scroll, and making the UI feel broken.

Scope:
- popup roundup status
- popup microphone errors
- side panel agent-cycle notifications
- any other nearby inline notification patterns you find on these surfaces

Goals:
- move transient status and error feedback to the shared non-blocking notification pattern
- prevent notification-driven layout shifts
- keep messages dismissible where appropriate
- preserve visibility without hijacking the page structure

Acceptance:
- popup home does not become scrollable because of transient notifications
- side panel content does not get pushed down by agent-cycle messages
- notification behavior is consistent across both surfaces
```

## Prompt 2: Popup Roundup Concurrency

```text
Task slug: popup-roundup-concurrency

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Fix the popup capture UX so `Round up chickens` can run without making the whole popup feel frozen.

Problem:
- pressing roundup disables too much UI
- long tab scans feel heavy and blocking
- users should still be able to trigger other capture actions like audio, file upload, screenshot, or manual tab capture while roundup is in flight

Goals:
- keep roundup visibly in progress
- avoid disabling unrelated capture actions
- queue safe parallel captures into the Chickens flow
- use a passive progress treatment rather than a global freeze

Acceptance:
- roundup does not block unrelated capture actions
- popup remains responsive during roundup
- parallel capture requests land in the draft/chickens pipeline without regressions
```

## Prompt 3: Shared Capture Dialog Cleanup

```text
Task slug: shared-capture-dialog-cleanup

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Clean up the shared capture dialog used by file upload and screenshot flows.

Problems to solve together:
- selected images have no preview
- copy says `save to pocket coop` when this is still a draft-stage capture
- form structure is messy and can overflow horizontally
- large uploaded images may need smarter compression or resizing before entering the draft flow

Goals:
- show image previews before save
- show a sane file summary for non-image files
- update copy to draft/chickens language
- standardize dialog structure for popup and side panel widths
- audit and improve large-image handling without harming normal quality

Acceptance:
- file upload and screenshot both benefit from the same dialog improvements
- no horizontal overflow remains
- pre-review copy no longer implies saving directly to a coop
```

## Prompt 4: Audio Permission And Error Flow

```text
Task slug: audio-permission-flow

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Investigate and fix the popup audio capture flow.

Problem:
- clicking audio immediately shows microphone access denied
- the browser does not appear to prompt first
- the resulting error presentation is disruptive and currently handled poorly

Goals:
- trace the full permission request path
- distinguish first-run promptable state from true denial or unsupported context
- request permission correctly in the right extension surface
- route resulting errors through the normalized notification system

Acceptance:
- first-time microphone access prompts when possible
- denial is only shown when it is real
- user-facing messaging is specific and recoverable
```

## Prompt 5: Manual Tab Capture Dedupe

```text
Task slug: manual-tab-capture-dedupe

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Loosen the manual tab capture dedupe policy so explicit user intent is respected.

Problem:
- `Capture tab` can respond with `This tab did not produce a new capture`
- that is too restrictive for deliberate recapture and makes the UI feel like it is refusing clear intent

Goals:
- keep protection against immediate accidental double-clicks
- allow explicit recapture of the same tab when the user intentionally triggers capture again
- improve messaging so the system does not feel obstructive

Acceptance:
- deliberate recapture works
- accidental immediate duplicates can still be suppressed if needed
- messaging reflects user intent
```

## Prompt 6: Roundup Ingestion Investigation

```text
Task slug: roundup-ingestion-investigation

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Do a deep investigation on the roundup tab-ingestion pipeline. Clearly relevant sports tabs are not being turned into chickens for a sports-focused coop.

Trace:
- tab discovery
- dedupe and already-captured checks
- relevance matching against coop purpose
- candidate generation
- insertion into the chickens feed
- status reporting back to the UI

Goals:
- reproduce the failure
- identify the highest-confidence root cause
- fix the real issue, not just the messaging

Acceptance:
- clearly relevant open tabs can be rounded up for an aligned coop
- status messaging accurately explains what happened
- incorrect suppression is removed
```

## Prompt 7: Chickens Feed Tone-Down

```text
Task slug: chickens-feed-tone-down

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Reduce the noise and repetition in the initial Chickens feed content after joining a coop.

Problem:
- initial generated content feels loud
- some orientation content is useful, especially around coop soul, but the overall feed feels repetitive and over-generated

Goals:
- keep the useful orientation value
- reduce repetition
- improve signal-to-noise and scanning comfort

Acceptance:
- initial feed feels calmer and more intentional
- repetitive generated items are reduced without removing useful orientation
```

## Prompt 8: Signal/Draft Consolidation

```text
Task slug: signal-draft-consolidation

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Unify the user-facing Chickens review model so different ingestion paths converge into one digestible review card shape.

Problem:
- the product currently exposes a conceptual split between signals and drafts
- tab-ingested content, user-ingested content, and AI-digested content can feel like different object types to the user
- the desired experience is one review card format: title, why it matters, tags, push controls, and preview media where applicable

Inputs that must converge:
- user audio
- file upload
- screenshot
- other user-provided capture/context flows
- tab roundup and other agent-routed tab signals

Goals:
- define and implement one user-facing Chickens review-card contract across ingestion modes
- ensure user-ingested captures are already synthesized into that compact review shape before review
- ensure tab data is automatically synthesized into the same shape
- keep media previews where applicable (thumbnail, image, audio preview, etc.)
- reduce the need for users to understand whether an item is internally a signal or a draft before deciding what to do with it

Required card structure:
- title
- why it matters
- tags
- push action(s) for one or more recommended coops
- preview media where applicable

Acceptance:
- Chickens presents one consistent review card model regardless of whether content originated from user capture or tab/agent routing
- the default review experience does not require the user to reason about separate signal vs draft card types
- push controls are coherent across the unified review surface
- preview behavior stays aligned with existing image/audio preview rules where applicable
- internal pipeline distinctions may remain, but the user-facing review contract is unified
```

## Prompt 9: Side Panel Agent Actions Wiring

```text
Task slug: sidepanel-agent-actions-wiring

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Investigate the side panel agent root view, especially `Run now`, which currently appears inert or fake.

Goals:
- trace whether the actions are actually wired
- determine whether this is a missing implementation, silent failure, or state update bug
- make the actions real, or disable/hide them until they are real
- ensure resulting feedback uses the normalized notification behavior

Acceptance:
- `Run now` produces a real observable result, or is clearly unavailable
- no inert controls masquerade as working actions
- feedback reflects real execution state
```

## Prompt 10: Side Panel Chickens Empty State

```text
Task slug: sidepanel-chickens-empty-state

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Fix the side panel Chickens empty state so `Round up loose chickens` is centered in the content area instead of being pinned awkwardly near the top.

Goals:
- center the empty-state message and CTA within the available content view
- preserve responsive behavior at common side panel sizes
- align styling with existing empty-state patterns

Acceptance:
- empty-state content is visibly centered
- the view feels intentional rather than top-loaded
```

## Prompt 11: Regression Sweep

```text
Task slug: popup-sidepanel-regression-sweep

Read and update /Users/afo/Code/greenpill/coop/.plans/features/popup-sidepanel-walkthrough/eval/session-state.md before touching code.

Run a final regression sweep across the walkthrough issues after the implementation prompts have landed.

Check:
- popup notifications do not push layout
- roundup remains responsive
- file and screenshot dialog preview/copy/layout are aligned
- audio permission flow behaves correctly
- manual tab recapture works
- roundup ingestion produces expected chickens
- Chickens presents the unified review-card contract across signal and draft sources
- side panel agent feedback is real and non-disruptive
- side panel empty state is centered

Deliver:
- a concise pass/fail matrix
- any remaining gaps with severity and likely owner
- updates to the shared session state file so follow-on agents do not regress the fixed behaviors
```
