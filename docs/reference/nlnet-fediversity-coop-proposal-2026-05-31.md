# NLnet NGI Fediversity: Coop proposal (draft) + go/no-go

**Fund:** NLnet NGI Fediversity (NGI0, European Commission / Horizon Europe)
**Form:** https://nlnet.nl/propose  ·  **Deadline:** **2026-06-01 12:00 CEST (noon)** (confirmed on nlnet.nl)
**Band:** €5,000–€50,000 (first-time cap €50K) · 11th call, €450K total pool
**Linear:** RESR-26 · **Strategy:** [NLnet Grant Strategy (June 2026)](https://linear.app/greenpill-dev-guild/document/nlnet-grant-strategy-june-2026-commons-fediversity-taler-7540821bd68e)
**Sibling app (pending, do not overlap):** RESR-38: NGI Zero Commons "Interoperable Reporting Infrastructure", €48K, status *Applied*

---

## Verdict: YES, submit. High-confidence, low marginal effort.

This is the cleanest grant you have open right now. Reasoned, not just an echo of the ⭐:

- **Non-dilutive, low-risk money.** €5–50K, milestone-paid on delivery, no equity, OSS-native. Worst case you ship hardening you wanted anyway.
- **Marginal effort is genuinely small.** You already filled this exact `/propose` form in April (RESR-38). You have a proven structure, a reusable AI-disclosure block, and an evidence library. This is a *second* proposal on the same form, not a cold start.
- **No cannibalization.** NLnet explicitly allows multiple proposals per batch, judged independently. A Coop/Fediversity ask does not compete with your pending Commons ask: different fund, different codebase, different scope.
- **The code is real. I verified it against `/Users/afo/Code/greenpill/coop`:** Yjs/y-webrtc/y-websocket/y-indexeddb in `package.json`; a real Hono+Bun signaling + doc-sync server at `packages/api/src/ws/yjs-sync.ts`; ADR-002 Local-First Data Ownership, ADR-003 Passkey-First Identity, ADR-007 Yjs CRDT Sync; a `member-account` module and a `greengoods` integration module. This is not slideware.

**One honest caveat (frame around it):** NGI Fediversity is centered on *"the hosting stack of the future"*: making **federated services self-hostable** (its examples are PeerTube, Mastodon). Coop is a **strong-*adjacent*** fit, not the textbook fit the Linear comment claims. Your winning angle is to speak the fund's language: **a self-hostable sync/signaling server, peer-to-peer with no central server, full data portability, and a group that genuinely owns and governs itself** (no platform owner). Pitched as "a notes app," it loses. Pitched as **federation + data-ownership infrastructure**, it wins.

## What makes this fundable (and where to stay honest)

- **Coop is in active development (pre-production).** Be consistent everywhere: the core (local-first capture, CRDT sync, permissionless passkey identity, export) is working code; multi-owner group control, hardened live federation, and the Green Goods integration in the field are the **maturation this grant funds**. Green Goods is the in-production app; Coop is the substrate being matured for it.
- **Lead with the code, not the metrics.** For a *Coop* proposal the proof is the architecture (verified above). The Green Goods production numbers (16 gardens / 53 gardeners, etc.) are **~6 weeks old and are Green-Goods proof, not Coop proof**. Use them only as "downstream adoption," and only if refreshed.
- **Scope to what's live.** In the public-release profile (`config/env/profiles/public-release.env`), `ONCHAIN_MODE=mock`, `ARCHIVE_MODE=mock`, `SESSION_MODE=off`. So the local-first capture + CRDT sync + passkey identity + export are real today; onchain anchoring + Filecoin archival are **mock by default**. Frame *hardening those to production* as the funded R&D; don't claim they ship live.
- **Don't claim a prior NLnet grant.** Every primary source shows NLnet as *Applied/pending*. The "Evidence Commons completed grant" was an AI hallucination (see strategy §2.1). State the April app as pending, honestly.

## Pre-submit checklist (human gates, none block drafting)

- [ ] **License = AGPL-3.0 (decided).** Note: the NLnet form has **no dedicated license field**, so state it inline in the abstract/ecosystem prose, not a form box. NLnet's FOSS requirement applies to the **results of the funded work**, enforced via the **grant agreement if you win**; it is **NOT** an application-time eligibility gate (verified on nlnet.nl Guide + FAQ, 2026-05-31), so adding a LICENSE file to coop is **not a pre-submission blocker**. *Optional but smart:* add the AGPL-3.0 LICENSE now anyway (~15 min): coop has no license today (= "all rights reserved" to a reviewer). You need it on award regardless. (Note: "AGPL-2.0" is not a real license; GNU Affero GPL is **AGPL-3.0**.)
- [ ] **Name contributors + hours** per milestone (the budget below has role placeholders, `[afo to fill]`).
- [ ] **PGP public key**: the April form left this blank; add one this time.
- [ ] **Frame globally, not Europe-first.** Lead with Green Goods's genuine global footprint (Global South + Europe); keep the European dimension as a real but secondary note (EU-hosted node + European-rooted protocols + EU communities among many). Coop is **not** deployed in any pilots yet (Spain/Italy included); those communities are prospective Coop users.
- [ ] **No "multisig" claim; multi-owner control is *scope*, not shipped.** The coop's shared account is single-owner today; multi-owner shared ownership and control is funded **Deliverable 2**. Say "Safe-based group account (single-owner today; member-owned multi-owner control is in scope)."
- [ ] **No "crypto" anywhere** (deliberate language choice). Lean into permissionless identity, blockchain, Ethereum, self-sovereign ownership.
- [ ] **AI-disclosure**: reuse April's block verbatim, update the prompt date.
- [ ] (Optional) refresh Green Goods indexer metrics if you cite any.

---

# READY-TO-PASTE DRAFT: NLnet `/propose` (NGI Fediversity)

> Mirrors the field structure of your submitted April app (RESR-38). Trim to NLnet's char limits on paste. Everything below is grounded in verified code or flagged `[fill]`.

### Project name
**Coop: a self-hostable, federated sync layer for local-first, member-owned group knowledge**

### Applicant / contact
- Applicant: Afolabi Aiyeloja, Greenpill Dev Guild, United States
- Email: `afo@greenpill.builders` · Phone: `[afo to fill]` · PGP: `[afo to add]`
- Project code repository: `https://github.com/greenpill-dev-guild/coop` *(confirm public URL)*

### Requested amount
**€48,000** (@ €100/hour ≈ 480 hours), adjustable down to land cleanly under the €50K first-time cap.

### Abstract (what it is + expected outcome, keep ~1,200 chars)
Coop lets community groups capture, refine, and publish **shared group knowledge that lives on their own devices and syncs peer-to-peer, with no central server and no platform owner.** It is built on CRDTs (Yjs over WebRTC/WebSocket) with a small **self-hostable** signaling and document-sync server, local-first storage, and **permissionless identity**: each member's passkey is also their own Ethereum smart account, so members never need a wallet, a seed phrase, or any funds to participate. Publishing is an explicit human gesture and all data is exportable. This project hardens Coop's self-hostable federation, data portability, and **member-owned group control** to production: anyone can run a Coop node, federate with peers, bridge to the ATProto/Fediverse data layer, move their data out at any time, and collectively own and govern their coop rather than depend on a single administrator. **Outcome:** a documented, **AGPL-3.0** self-hostable federated service, plus a reference deployment and a threat model, so groups own and can relocate their collective memory between services instead of being locked into one.

### Have you been involved with relevant projects before? (contributions)
Greenpill Dev Guild builds open-source public-goods software. **Coop** is our local-first group-knowledge tool: public monorepo, Yjs CRDT peer sync, a Bun/Hono signaling + doc-sync server, passkey-first permissionless identity, browser-first surface (architecture decisions recorded as ADRs 001–009).

**How Coop and Green Goods fit together (our flagship downstream app):** Coop gives every member a permissionless, self-sovereign identity in which a **WebAuthn passkey is also their Ethereum smart account (ERC-4337)**, provisioned by Coop's `member-account` module so members never need a wallet, a seed phrase, or funds to pay fees, alongside a Safe-based account for shared group ownership. The `greengoods` shared module and the in-extension "Roost" workspace are built so that Green Goods's real-world workflows run on this substrate: members submit work, operators approve it as attestations, assessments are recorded, and verified impact is packaged as **Hypercerts** (on-chain coordination, governance, and impact reporting). Coop is in active development: this integration is built in code today, and Green Goods, our in-production app for regenerative communities, is the first community Coop is designed to serve as it reaches production. So Coop is the federated, self-owned identity-and-coordination layer, and Green Goods is the concrete demonstration of what a community will do on it, with no platform owner.

The guild has shipped open-source work supported by Octant (Epochs 5/10; 12 accepted), Arbitrum DAO, Gitcoin and Grant Ships. We have a **pending** NLnet NGI Zero Commons application (April call, status *Applied*) for a **separate, non-overlapping** Green Goods interoperability scope; this Fediversity ask is Coop-only (federation, portability, and member-owned identity infrastructure). Named contributors and hours: `[afo to fill]`.

### What will the requested budget be used for? (milestones / deliverables)
€48,000 @ €100/hr, milestone-paid. Six deliverables:

1. **Self-hostable signaling + federation hardening: €12,000 (120h).** Production-grade, one-command-deployable signaling + Yjs doc-sync server (building on `packages/api/src/ws/`); secure peer discovery; node-to-node federation so independent Coop instances share documents without a central registry.
2. **Member-owned multi-owner control of a coop: €8,000 (80h).** Net-new work (not yet shipped). Today a coop's shared Safe-based account has a single owner; this delivers genuine collective ownership: multi-owner threshold control of the group account (add/remove members, set approval thresholds, recover access), so a coop is owned and governed by its members rather than one administrator.
3. **Data portability + ATProto/PDS bridge: €10,000 (100h).** Hardened export/import (open, documented formats) and a bridge to the ATProto/Fediverse data layer, so a group's knowledge can be relocated between services and self-hosted PDSes. Directly answers the fund's "separate content from the service provider."
4. **Reference self-host deployment + operator docs: €8,000 (80h).** A public, EU-hostable reference node; container + deploy recipe; operator/onboarding guide so a non-expert community can run its own Coop.
5. **Encrypted-at-rest + threat model / audit-ready posture: €6,000 (60h).** Encryption-at-rest for local data, access control with no central identity provider (passkey-first), and a published threat model. Includes moving the currently mock-default onchain/archival rails toward a production path.
6. **Public retrospective + reusability notes: €4,000 (40h).** Open write-up, reusable patterns for other local-first/federated projects, and upstream learnings to the Yjs/ATProto communities.

### Compare your project with existing or historical efforts (differentiation)
- **vs Mastodon / PeerTube (server-federated):** those federate *servers*; Coop federates *peers and devices*: local-first, works offline, the server is optional and self-hostable rather than required.
- **vs Google Docs / Notion (central SaaS):** no central owner; data lives on-device; publishing is an explicit gesture; full export. No lock-in.
- **vs CRDT libraries (Automerge, Liveblocks, etc.):** Coop is not a library; it provides a complete local-first product surface (browser extension + permissionless passkey identity + explicit-publish + export) **and** a self-hostable sync server, designed around a real downstream application.
- **What's new:** Coop is not a notes app, it's a **self-hostable, federated coordination substrate with permissionless, self-sovereign identity**, where each member's passkey *is* their own Ethereum smart account and a coop is owned and governed by its members, not a platform. It is designed around our in-production app **Green Goods**, whose coordination, governance, and verifiable impact-reporting workflows (work attestations + Hypercerts) are built to run on this substrate as Coop matures.

### Significant technical challenges
1. **Easy, secure self-hosting** of signaling + doc-sync (one-command deploy) without weakening peer-discovery security.
2. **Federation & portability without a central registry**: moving documents between independent nodes and bridging to ATProto/PDS.
3. **Member-owned multi-owner control**: moving a group account from single-owner to a multi-owner threshold model (add/remove/recover) that ordinary members can use safely.
4. **Conflict-free merge at scale**: Yjs tuning for large/long-lived group docs and long offline divergence.
5. **Encryption-at-rest + access control with no central identity provider** (passkey-first).
6. **Production-hardening currently-mock rails**: onchain anchoring and Filecoin archival are mock in the public-release profile today; making them robust and production-ready is real R&D (stated honestly).

### Ecosystem & engagement (global open-source commons)
Coop sits in the **local-first software** and **ATProto/Fediverse** ecosystems and the Yjs community. We will publish the self-host guide and ADRs openly, run a public reference node, and upstream learnings to the Yjs and ATProto communities.

**This is a global commons, built for communities worldwide.** Our in-production app **Green Goods**, the first community Coop is designed to serve, already works with regenerative groups across the globe, in **Nigeria, Brazil, South Africa, Uganda, Kenya, Spain, and Italy** `[afo: confirm current list]`, across agroforestry, waste, education, and solar. These are exactly the contexts that most need self-owned, portable, offline-capable group infrastructure: places where central platforms fit poorly, connectivity is uneven, and data sovereignty matters most. Engagement targets: local-first/Fediverse developers, self-hosting collectives, and community groups across these regions who need to own and govern their shared knowledge.

**European dimension:** the underlying protocols (ATProto, the Fediverse) are European-rooted, we will host the public reference node in the EU, and several of these communities are European (Spain, Italy), so the work feeds the European internet commons directly while remaining global by design.

### Open-source license
*(Internal note, not a form field: the NLnet `/propose` form has no dedicated license box, so this is stated inline in the abstract/ecosystem prose rather than pasted as its own answer.)* **License: AGPL-3.0** for the Coop service: strong network copyleft, so improvements to a self-hostable federated service flow back to the commons. All results of the funded work will be released under AGPL-3.0 in its entirety (NLnet's non-negotiable condition, enforced via the grant agreement). Relicensing the existing repo is a condition of award, not a submission prerequisite, but adding the LICENSE now is a cheap credibility signal for a FOSS-centric fund.

### Use of generative AI in this application
Reuse April's disclosure verbatim, updating the date: *Yes, Claude (Anthropic) and ChatGPT (OpenAI) were used for grant-alignment analysis, structural editing, wording comparisons and concise redrafting; outputs were reviewed and substantially edited by the applicant. Prompt date: `[2026-05-31]`.*

---

## Grounding notes: verified vs. corrected (so nothing ships unchecked)

| Claim | Status | Source |
| -- | -- | -- |
| Deadline 2026-06-01 12:00 CEST, €5–50K | ✅ confirmed | nlnet.nl/fediversity (fetched 2026-05-31) |
| Coop has **no LICENSE** | ✅ confirmed, but **NOT a submission blocker** | no root LICENSE; no `license` in `package.json` |
| FOSS license = condition of *funded results*, enforced via grant agreement **on award**; not an application eligibility gate | ✅ confirmed | nlnet.nl Fediversity Guide for Applicants + FAQ (fetched 2026-05-31) |
| Yjs CRDT P2P stack | ✅ confirmed | `package.json`: yjs/y-webrtc/y-websocket/y-indexeddb |
| Signaling + doc-sync server | ✅ confirmed | `packages/api/src/ws/yjs-sync.ts` (+ handler/auth/topics) |
| Local-first / passkey / CRDT ADRs | ✅ confirmed | ADR-002, ADR-003, ADR-007 |
| Passkey = per-member Ethereum smart account (ERC-4337, no fees to user) | ✅ confirmed in code | `member-account` module: `provisionMemberAccounts`, `sendTransactionViaMemberAccount`, `toSafeSmartAccount`/`toKernelSmartAccount`; ADR-003 + ADR-006 |
| Green Goods coordination/governance/impact built on Coop | ✅ in code (dev-stage), **not deployed in field pilots** | `greengoods.ts` exports: `submitGreenGoodsWorkSubmission`, `submitGreenGoodsWorkApproval`, `createGreenGoodsAssessment`, `submitGreenGoodsImpactReport`, `mintGreenGoodsHypercert` |
| **Coop overall maturity** | ⚠️ **active development / pre-production** | per afo, 2026-05-31 |
| Multi-owner (member-controlled) Safe | ❌ **NOT shipped**, now funded Deliverable 2 | single-owner today per 2026-03-20 onchain memo; do not say "multisig" |
| onchain/archive **mock by default** in public release | ✅ confirmed | `config/env/profiles/public-release.env`; live only under `local-live-sepolia.env`/`operator-live.env` |
| Spain/Italy run Coop | ❌ **NO**, Coop not deployed there | per afo, 2026-05-31: Green Goods communities, prospective Coop users only |
| ADR numbers in strategy doc (e.g. "explicit-publish = ADR-005") | ⚠️ **wrong, corrected here** | ADR-005 is "barrel-imports", ADR-007 is "yjs-crdt-sync" |
| Production metrics (16 gardens…) | ⚠️ ~6 wks stale; Green-Goods, not Coop | strategy doc §6 (flagged "refresh before submit") |
