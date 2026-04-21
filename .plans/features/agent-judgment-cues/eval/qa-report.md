# QA Report — Passive Judgment Cues

## Outcome

- QA pass 2 closes `done` with three durable product/UX observations below;
  all three are resolved by the 2026-04-20 product-completion passes.
- No spec-level defect found. All six acceptance criteria in `spec.md` match
  shipped behavior. Original QA targeted tests were green: `risk.test.ts` (10),
  `review-risk.test.tsx` (2), `operator-console.test.tsx` (36) — 48 total.
- `bun run plans validate`, `bun run validate quick`, `bun run validate smoke`
  were already green before this pass (per audit and session state).

## Post-Release Update — 2026-04-20

- The first product-completion simplification pass addressed Finding 2 from
  this report.
- The second product-completion pass addressed Finding 3 from this report.
- Publish, archive, and sync-only plans now stay in approval framing across
  Roost helper copy and headings; “Needs Judgment” and inline acknowledgement
  remain reserved for `live`, `permission`, `destructive`, and
  `permanent-record`.
- The permanence pass added focused validation across shared risk
  classification, shared formatter copy, Roost plan cards, and Nest waiting
  chores.
- The final product-polish pass passed 60 targeted tests across shared risk,
  review helpers, Roost plan cards, Nest helper plans, and Nest waiting chores.
- Finding 1 is now resolved in product behavior. All three findings from
  this report are resolved.

## Scope Of This Review

Read-only UX review against `main` at the point the hardening commit `484078d`
landed. Surfaces inspected:

- `packages/extension/src/views/Sidepanel/review-risk.tsx` — cue helpers and
  render utilities
- `packages/shared/src/modules/policy/risk.ts` — classifier, priority order,
  summary and acknowledgement copy
- `packages/shared/src/contracts/schema-policy.ts` — full action-class enum
- `packages/extension/src/views/Sidepanel/tabs/RoostFocusSection.tsx` — Roost
  “What’s Next” judgment phrasing
- `packages/extension/src/views/Sidepanel/tabs/RoostAgentSection.tsx` — Roost
  pending-plans card heading and per-plan cue render
- `packages/extension/src/views/Sidepanel/operator-sections/AgentObservationsSection.tsx`
  — Nest helper-plan row cue render
- `packages/extension/src/views/Sidepanel/operator-sections/PolicyAndQueueSection.tsx`
  — Nest waiting-chores cue render for both approve and execute paths

## Visual Verification

Not performed on a running dev build in this pass. The rendering claims
(badges present, ack checkbox disables/enables the primary button, helper line
text wiring) were covered by the original 48 targeted tests and the final
60-test focused regression pass. The density claim —
“badges remain readable under real data” — is not something static review can
confirm with full confidence because CSS wrap behavior under variable coop
state depends on the actual DOM. If the team wants live-build screenshots of
Roost pending-plans and Nest waiting-chores under mixed-risk queues, reopen
for a follow-up pass; that is disproportionate work for the current review
scope but cheap if prioritized on its own.

## Four QA Pass 2 Questions

### 1. Badge density in Roost and Nest stays readable

**Answer: yes, with one caveat.**

- Roost “Needs Judgment / Needs Approval” card (`RoostAgentSection.tsx`) puts
  risk badges on their own `.badge-row` inside each plan item, separate from
  the title and confidence meta line. Max two risk badges plus a `+N`
  overflow per plan — bounded and spec-aligned.
- Nest “Helper Plans” row in `AgentObservationsSection.tsx` packs
  `[status] [provider] [N proposals] [risk badges…]` into one row. On a
  plan with two risk tags the row renders 5 badges. That is the densest
  combination I saw and is still bounded.
- Nest “Waiting Chores” row in `PolicyAndQueueSection.tsx` renders
  `[action-class label] [status] [coopId] [risk badges…]` — same shape,
  same bounded density.

Caveat: the coopId badge can be a short UUID prefix; real values should be
sanity-checked under narrow viewport widths to confirm the row wraps instead
of clipping. Not a defect, a visual polish check the team can pick up if it
comes up.

### 2. Acknowledgement wording is clear without escalating low-risk chores

**Answer: yes, threshold is right.** The original pass found one helper-copy
edge case; it is now resolved in product behavior.

- D3 is honored for low-risk work: publish / archive / sync stay passive
  (`renderAcknowledgementControl` returns null, primary button stays
  enabled, no checkbox appears). The 2026-04-20 permanence pass intentionally
  added `permanent-record` to the acknowledgement threshold alongside `live`,
  `permission`, and `destructive`.
- The acknowledgement labels are short and scoped to the risk being
  accepted: “I reviewed the live effect / permission change / irreversible
  effect”. The “I reviewed …” framing reads as an attestation, not a
  demand. Right weight.

### 3. Are additional high-risk action classes missing stronger copy?

**Answer: no missing coverage at the shipped threshold.** The original pass
found one product question about permanent-record actions; it is now resolved.

All 23 entries in `policyActionClassSchema` were walked against the
classifier:

- `permission` + `destructive` combos are correctly attached to the three
  Safe owner-mutation classes and to `green-goods-remove-gardener`.
- `live` is added to onchain writes when `onchainMode === 'live'`, as the
  spec requires.
- Low-risk tags (`publish`, `archive`, `sync`) are correctly assigned to
  publish, archive, and sync actions.
- `safe-deployment` has its own hardcoded operator copy and a disabled
  approval toggle in `PolicyAndQueueSection`, which is intentional and
  separate from the risk system.

### 4. Remaining human-judgment decisions explicitly called out

**Answer: yes at the code level; three product/UX questions were captured
below and are now resolved.**

---

## Findings

### Finding 1 — Destructive framing is subordinated to permission in the ack label

**Resolved.** The final product-polish pass kept badge ordering and
helper-line priority stable, but special-cased
`formatActionRiskAcknowledgementLabel` so actions tagged with both `permission`
and `destructive` use “I reviewed the irreversible effect.” `permanent-record`
still wins over all other acknowledgement copy, preserving the newer
“I reviewed the permanent public record” behavior.

Before the final product-polish pass, for an action class tagged
`[permission, destructive]` (e.g.
`green-goods-remove-gardener`, `safe-remove-owner`, `safe-swap-owner`,
`safe-change-threshold`) in mock mode, the acknowledgement label resolves to
“I reviewed the permission change” because `actionRiskPriority` orders
`permission` above `destructive` and `formatActionRiskAcknowledgementLabel`
picks the highest-priority high-risk tag.

The “Destructive” badge still rendered, and the helper line still read
“this changes who can act or what they can control”, but the irreversibility
framing is only visual (badge), not verbal (ack label). A user scanning the
checkbox line before approving could miss the irreversibility signal.

- Severity: resolved. No further action for this finding.
- Possible fixes, both one-line:
  - Swap `permission` and `destructive` in `actionRiskPriority` so the ack
    label prefers the destructive wording when both are present.
  - Or leave the priority order alone but give `formatActionRiskAcknowledgementLabel`
    a special case that prefers `destructive` over `permission`.
- Product decision: leave the priority order alone and special-case
  acknowledgement copy.

### Finding 2 — “Needs Judgment” for publish-only plans reads heavier than D3 intends

**Resolved 2026-04-20.** The follow-up product-completion pass tightened
`planNeedsJudgment` to acknowledgement-risk tags only. Publish, archive, and
sync-only plans now keep approval framing, while `live`, `permission`,
`destructive`, and `permanent-record` work keep “Needs Judgment” copy and
acknowledgement gating.

Before that pass, `planNeedsJudgment` returned true whenever
`riskTags.length > 0`, including a plan that only contained
`publish-ready-draft` proposals. In that case:

- `RoostAgentSection` section heading flips from “Needs Approval” to
  “Needs Judgment”.
- `RoostFocusSection` “What’s Next” line flips from
  “N agent plans need approval” to “N agent plans need judgment”.
- The helper line prefixes `Needs judgment: this will move a draft into
  shared coop space`.

D3 says publish / archive / sync should stay passive. The acknowledgement
requirement does stay passive (no checkbox). But the copy layer is not
passive — it actively tells the user this is a judgment call. Defensible
reading: any tagged action is a judgment call, and the acknowledgement
requirement is the only hard gate. But it is one level heavier than “low-risk
chores keep the same lightweight review flow” from the spec.

- Severity: resolved. No further action for this finding.

### Finding 3 — Permanent-record actions are not distinguished from reversible live effects

**Resolved 2026-04-20.** The follow-up product-completion pass introduced a
dedicated `permanent-record` risk tag for irreversible public onchain records.
Those actions now show `Permanent Record`, use the helper copy “this will
create a permanent public record,” and require the acknowledgement “I reviewed
the permanent public record.”

Several action classes write permanent public records on-chain:
`green-goods-mint-hypercert`, `green-goods-submit-impact-report`,
`green-goods-submit-work-submission`, `green-goods-create-garden`,
`green-goods-create-garden-pools`, `green-goods-create-assessment`,
`erc8004-register-agent`, `erc8004-give-feedback`.

Before the permanence pass, each of these was tagged `[live]` in live mode
and untagged in mock mode. The chosen fix was to introduce
`permanent-record` rather than stretch `destructive` over creation semantics.

- Severity: resolved. No further action for this finding.

## Decision

QA pass 2 closes `done`. None of the above blocks the pack. The ask from
QA pass 1 — confirm copy and visual weight still feel proportionate — is
answered: threshold and acknowledgement wiring are proportionate. As of the
2026-04-20 product-completion passes, Findings 1, 2, and 3 are resolved.

## Not Changed By QA Pass 2

- This was a read-only QA pass. The product-completion passes recorded above
  later changed `packages/` source and tests to resolve the findings.
- No other feature packs.
- No release docs.
- Lane metadata for `ui`, `state`, `qa_pass_1` — all stay `done`.
