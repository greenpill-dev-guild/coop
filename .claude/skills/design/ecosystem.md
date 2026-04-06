# Ecosystem — Relational Architecture for Coop

Design for webs of people and agents, not isolated users. Every surface exists in an ecosystem where one person's action shapes another's experience — and the agent is an active participant.

Based on [User Ecosystem Thinking](https://www.rethinkingusers.com/) (Youngblood, Chesluk, Haidary — BIS Publishers, 2021). Adapted from Green Goods' ecosystem model for Coop's member/operator/agent dynamics.

---

## The 15 User Archetypes — Coop Edition

Archetypes classify **relationships to the artifact**, not demographics. A single person occupies multiple archetypes simultaneously.

| # | Archetype | Definition | Coop Example |
|---|-----------|-----------|-------------|
| 1 | **Direct** | Engages the solution directly | Member capturing tabs, reviewing drafts in Chickens |
| 2 | **Indirect** | Experiences through another's use | Community member who benefits from a published artifact they never see |
| 3 | **Intermediary** | Enables others to engage | Operator onboarding members, sharing invite codes |
| 4 | **Governing** | Actions significantly affect another's quality | Operator configuring source allowlists, agent spending limits |
| 5 | **Dependent** | Engages as enabled by another | Member whose agent recommendations depend on operator's source config |
| 6 | **Terminal** | Focus of another's use — not a user themselves | The community or cause that benefits from the coop's coordinated knowledge |
| 7 | **Surrogate** | Acts as stand-in for another | Agent proposing drafts on behalf of members. Operator acting for absent member |
| 8 | **Serial** | Engages in a chain | Capture → agent draft → member review → Safe publish → archive chain |
| 9 | **Parallel** | Engages alongside similar others | Multiple members reviewing the same draft candidates |
| 10 | **Complementary** | Engages alongside different others | Member captures tabs while agent captures observations — different modes, shared output |
| 11 | **Generative** | Alters the solution itself | Operator adding new skills, configuring knowledge sources, creating coops |
| 12 | **Oblique** | Engages through byproducts | Researcher finding archived artifacts on Filecoin without using Coop |
| 13 | **Ambient** | Engages through environmental effect | Person whose community benefits from the coop's grant application work |
| 14 | **Autonomic** | Engages automatically, without awareness | **The Coop agent**, graph engine, sync layer, Safe contracts, ERC-8004 registry |
| 15 | **Conglomerate** | Technology as extension of self | Power user for whom Coop IS how they organize knowledge ("just how I think") |

---

## Coop Ecosystem Map

```
                          TERMINAL
                    Communities benefiting
                    from coordinated knowledge
                             │
                        impact flows to
                             │
     AMBIENT          ┌──────┴──────┐          OBLIQUE
   Community     ◄────│    DIRECT    │────►   Researchers
   neighbors          │   Members    │        finding CIDs
                      │   capturing  │        on Filecoin
                      │   reviewing  │
                      │   publishing │
                      └───┬────┬─────┘
                          │    │
            ┌─────────────┘    └─────────────┐
            │                                │
      GOVERNING                        AUTONOMIC
    Operators (config)              Coop Agent (observe)
    Safe signers                    Graph Engine (memory)
                                    Yjs Sync (propagate)
            │                       Safe Contracts (execute)
       enables                      ERC-8004 (identity)
            │                            │
      DEPENDENT                   shapes experience of
    Members                              │
    (need operator setup)          all Direct Users
    (need agent to draft)
```

### Multi-Archetype Nexus: The Agent

The Coop agent occupies four archetypes simultaneously:
- **Autonomic** — runs on observation triggers without conscious awareness
- **Surrogate** — proposes drafts on behalf of the collective
- **Complementary** — captures alongside members via different modalities
- **Generative** (future) — creates runtime skills, extends its own capabilities

Each archetype demands different UX: Autonomic-Agent needs visible heartbeat and state. Surrogate-Agent needs attribution ("agent insight" badge). Complementary-Agent needs its observations alongside member captures. Generative-Agent needs approval flows before self-modification.

---

## Three Systems Phenomena in Coop

### Interconnectedness
A member's draft quality depends on which sources the operator allowlisted, which depends on what the agent extracted from those sources, which depends on which inference tier was available. One weak link degrades the whole chain.

**Design implication**: When showing a draft, trace the chain. The "Sourced from" section surfaces interconnectedness.

### Synthesis
Optimizing capture flow + agent pipeline + review UX + publish flow individually doesn't guarantee the combined system produces good shared knowledge.

**Design implication**: Test flows end-to-end across archetypes. Does the chain from source → extraction → draft → review → publish actually produce useful shared knowledge?

### Emergence
When a coop develops shared understanding of "what's worth publishing" through repeated review cycles, that's emergent — produced by the precedent system, not designed explicitly.

**Design implication**: The reasoning trace / precedent system enables positive emergence. Watch for negative emergence (rubber-stamp approvals, source echo chambers).

---

## Ecosystem-Aware Design Patterns for Coop

### 1. Cascade Awareness

When one user's action affects another's experience, show the blast radius BEFORE the action:

| Action | Cascade | UI Pattern |
|--------|---------|-----------|
| Operator removes a source | Agent loses entities, past drafts show stale provenance | "47 entities from this source. 3 recent drafts reference it." |
| Operator changes spending limit | Agent's autonomous actions may be blocked | "Agent has 2 pending proposals above this new threshold." |
| Member rejects a draft | Agent records negative precedent, future similar drafts get lower confidence | "This will inform future recommendations." |
| Member publishes to coop | All members see the artifact, Safe signers may need to act | "Publishing to 3 members. Requires 2-of-3 Safe approval." |

### 2. Autonomic Actor Surfaces

Non-human actors that shape every member's experience. Make their state visible:

| Autonomic Actor | What It Does | Surface Pattern |
|-----------------|-------------|-----------------|
| **Coop Agent** | Observes, plans, proposes drafts | Heartbeat in Roost Agent. "Last cycle 8 min ago." |
| **Graph Engine** | Stores entities, provides retrieval | "214 entities, 891 relationships" in Knowledge section |
| **Yjs Sync** | Propagates state between members | Sync badge: "synced" / "2 pending" / "offline" |
| **Safe Contract** | Enforces multisig on publish | "2-of-3 signatures needed" before high-stakes actions |
| **ERC-8004 Registry** | Agent identity on-chain | Agent identity verified / unregistered status |

**Material guidance**: Autonomic actor surfaces are **Ambient Display** paradigm — Gauze material, peripheral, glanceable. Promote to **Command Surface** (Parchment) only when something breaks.

### 3. Surrogate User Support

The agent acts as surrogate for the collective. The UI must distinguish agent-generated content from member-generated content:

```
┌─────────────────────────────────────┐
│  Created by:  Coop Agent            │ ← Surrogate indicator
│  On behalf of: All members          │ ← Attribution
│  Provenance: agent insight          │ ← Provenance badge
│  ─────────────────────────────────  │
│  [Draft content]                    │
│  [Review] [Approve] [Reject]        │ ← Member still decides
└─────────────────────────────────────┘
```

Existing: the `formatProvenanceLabel()` function already returns "agent insight" for agent-generated drafts. The "Sourced from" section (knowledge sandbox UX) extends this with specific source references.

### 4. Relational Disclosure

Extends the Jarvis Principle with a relational dimension:

| Layer | Standard (Jarvis) | Ecosystem Extension |
|-------|-------------------|-------------------|
| **Glance** | Title, status, one metric | + Whose action created this? (provenance badge) |
| **Scan** | Summary, action buttons | + Who is waiting on this? (coop target count) |
| **Engage** | Full detail | + What sources informed this? (provenance chain) |
| **Deep Dive** | Raw data, audit trail | + Full decision trace + precedent history |

---

## Ecosystem Readiness Checklist

Run for views that involve multiple user types or agent interaction:

```
Ecosystem Readiness Check
│
├─ [ ] Multi-archetype awareness?
│      Does this surface serve users in different archetype roles?
│      (member reviewing vs. operator configuring vs. agent proposing)
│
├─ [ ] Cascade visibility?
│      When a governing action affects dependent users, is the
│      blast radius shown before the action is confirmed?
│
├─ [ ] Serial chain position?
│      If this entity flows through multiple actors (source → agent → draft → review),
│      is the current position in the chain visible?
│
├─ [ ] Autonomic actors surfaced?
│      Are agent/sync/contract states visible as ambient indicators,
│      not hidden behind generic loading states?
│
├─ [ ] Surrogate distinction?
│      Are agent-generated items clearly marked with provenance?
│      Can the member see WHY the agent created this?
│
├─ [ ] Terminal user presence?
│      Does the interface remind members that real communities benefit
│      from the knowledge they curate? (Not just abstract "impact")
│
└─ [ ] Ecosystem tested end-to-end?
       Has the flow been tested across archetype transitions?
       (capture → agent observation → draft → review → publish → archive)
```
