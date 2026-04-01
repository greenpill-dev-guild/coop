---
title: "Hackathon Demo Shot List"
slug: /reference/hackathon-demo-shot-list
---

# Hackathon Demo Shot List

This is the operator runbook for recording the demo. It is written as a shot-by-shot checklist with
click-level actions.

For spoken narration, use [Hackathon Demo Voiceover Script](/reference/hackathon-demo-voiceover-script).

## Assumptions

- two coops already exist before recording begins
- the extension is loaded and pinned
- one messy browser window is prepared with tabs that clearly map into three coop themes
- the Green Goods path is ready in either new-garden or existing-garden mode
- the archive path is ready in either rehearsal or live mode

## Shot List

### Shot 1. Landing Setup

#### Goal

Establish the product and the problem in one visual.

#### Operator actions

1. Open `https://coop.town`.
2. Pause on the hero.
3. Slow-scroll through the hero and one explanatory section.
4. Stop at a point where the install path is visible.

#### Capture notes

- keep the scroll controlled
- do not jump around the page

#### Fallback

- if the live page is not behaving, use the local or staged app URL you have already vetted

### Shot 2. Open Extension And Show Existing Coops

#### Goal

Make the multi-coop setup visible before creating the third coop.

#### Operator actions

1. Open the extension sidepanel.
2. Navigate to the coop list or selector.
3. Briefly show the two existing coops.
4. Enter the create-coop flow.

#### Capture notes

- hold long enough for the viewer to register that multiple coops already exist

### Shot 3. Create The Third Coop

#### Goal

Show live coop creation.

#### Operator actions

1. Fill the create-coop flow.
2. Enter the coop name.
3. Enter or confirm purpose and preset.
4. Complete any required setup fields.
5. Submit the form.
6. Wait until the new coop appears in the sidepanel state.

#### Capture notes

- do not narrate every field
- move cleanly and confidently through the form

#### Fallback

- if the full form is too slow in real time, prefill as much as possible before recording and only
  complete the last visible steps live

### Shot 4. Show The Messy Tab State

#### Goal

Make the browser clutter feel real.

#### Operator actions

1. Switch back to the main browser window.
2. Show the crowded tab strip.
3. Pause briefly so the viewer can register the chaos.

#### Capture notes

- the tabs should look intentionally messy, not random

### Shot 5. Run Roundup

#### Goal

Convert the messy browser state into chickens.

#### Operator actions

1. Trigger the roundup action from the popup, sidepanel, or current preferred UI.
2. Return to the `Chickens` surface.
3. Wait for the chickens to populate.

#### Capture notes

- leave enough time for the state change to read on screen

#### Fallback

- if the roundup takes too long, have the chickens already partially ready and still show the final
  moment of the action

### Shot 6. Open Chicken Synthesis

#### Goal

Show that the system is structuring knowledge and not just collecting links.

#### Operator actions

1. Open the first strong chicken.
2. Show the synthesized summary or interpretation.
3. Show the recommended routing or coop fit if visible.
4. Close or return to the list.

#### Capture notes

- choose a chicken that clearly maps to one coop

### Shot 7. Route Chickens Into Three Coops

#### Goal

Make multi-coop routing the center of the demo.

#### Operator actions

1. Open a chicken or draft that belongs to coop A.
2. Use the publish/share/routing controls to send it to coop A.
3. Return to the list.
4. Repeat for coop B.
5. Repeat for coop C.
6. Open the coop list, feed, or relevant shared-state surface to confirm the routed result.

#### Capture notes

- keep the three examples distinct
- if the UI supports explicit suggested targets, pause on that moment

#### Fallback

- if three full routing actions are too long, do one in full and visually confirm the others in a
  partially completed state

### Shot 8. Open Membership Controls

#### Goal

Transition from content routing to the trust model.

#### Operator actions

1. Open `Nest` or the current membership/admin surface.
2. Navigate to invite controls.
3. Select the relevant invite type.
4. Generate the invite.
5. Pause while the invite is visible.

#### Capture notes

- make the invite flow look deliberate and secure, not buried

### Shot 9. Optional Receiving-Side Join

#### Goal

Show the join path if time and setup allow.

#### Operator actions

1. Switch to the second profile or device.
2. Open the join or pair route.
3. Enter or accept the invite.
4. Confirm the member-join state.

#### Capture notes

- if this adds too much friction, keep it brief

#### Fallback

- if you skip the receiving side, keep the invite visible and narrate the passkey-first,
  peer-oriented join model

### Shot 10. Open Green Goods Path

#### Goal

Show the bridge from shared knowledge into onchain coordination.

#### Operator actions

1. Return to the extension sidepanel.
2. Open the relevant Green Goods surface, likely `Roost` or the current operator path.
3. Show the garden connection state.
4. Demonstrate either:
5. the new-garden path
6. or the existing-garden connection path

#### Capture notes

- be explicit in rehearsal about which path you are showing

### Shot 11. Show Governance Setup

#### Goal

Position Green Goods as governance, capital formation, capital allocation, and impact infrastructure.

#### Operator actions

1. Open the policy or session-aware operator controls.
2. Show the bounded execution context if visible.
3. Navigate to the action that creates garden pools or the closest current pool-creation surface.

#### Capture notes

- pause on any visible cue that shows scope or approval boundaries

### Shot 12. Execute Priority-Aligned Pool Creation

#### Goal

Show bounded initiative by the coop agent.

#### Operator actions

1. Surface the agent recommendation or the prepared action state.
2. Show that the proposed pool aligns with coop priorities.
3. Trigger the bounded action.
4. Wait for the success state or resulting pool state.

#### Capture notes

- narrate this as bounded session-key action, not general autonomy
- if the live label is `create garden pools`, use that label on screen and explain it in voiceover

#### Fallback

- if the full action is risky live, use a rehearsal or mock run and say so directly

### Shot 13. Return To Shared Coop State

#### Goal

Reconnect the onchain beat back to the coop itself.

#### Operator actions

1. Return to the coop view or shared state surface.
2. Briefly show the coop after governance action.

#### Capture notes

- this shot is short but important because it closes the loop between knowledge and governance

### Shot 14. Trigger Filecoin Archive

#### Goal

End on durable memory and proof.

#### Operator actions

1. Open `Coops`.
2. Trigger the archive flow.
3. Show the receipt or proof export when it appears.

#### Capture notes

- hold the receipt long enough to read as proof, not just as a flashing success state

#### Optional line-dependent pause

- if encrypted envelope behavior is part of the path, pause where that is legible

### Shot 15. Future Coda

#### Goal

Leave the audience with the expansion path.

#### Operator actions

1. Keep the coop or board state on screen.
2. Optionally open the board or another future-facing visual.
3. Hold steady while the final narration lands.

## Rehearsal Checklist

- rehearse the full flow once without speaking
- rehearse the full flow once with the voiceover
- time the routing beat because it is the longest and most important transition
- decide in advance what gets cut if one shot misbehaves
- keep a fallback plan for:
- coop creation
- invite flow
- Green Goods action
- archive flow

## Cut Priorities If Time Is Short

If you need to compress:

1. keep coop creation
2. keep the messy-tabs roundup
3. keep the multi-coop routing beat
4. keep Green Goods plus bounded pool creation
5. keep the Filecoin close
6. shorten, but do not delete, the invite beat

## Related Docs

- [Hackathon Demo Video Outline](/reference/hackathon-demo-video-outline)
- [Hackathon Demo Voiceover Script](/reference/hackathon-demo-voiceover-script)
- [Demo & Deploy Runbook](/reference/demo-and-deploy-runbook)
