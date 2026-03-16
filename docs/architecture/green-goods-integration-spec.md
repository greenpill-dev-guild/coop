---
title: "Green Goods Integration"
sidebar_label: "Green Goods"
sidebar_position: 2
---

# Green Goods Integration Spec

## Scope

This spec adds Green Goods as the main non-financial onchain substrate for Coop's trusted-node agent loop.

Phase 1 is intentionally narrow:
- bootstrap a Green Goods garden owned by the coop Safe
- sync bounded garden metadata and domain configuration
- ensure Gardens V2 signal pools exist
- keep all execution inside the existing Coop action bundle, policy, and replay-protection path

Phase 1 explicitly excludes:
- token transfers
- approvals and allowances
- cookie jar funding or withdrawals
- marketplace actions
- vault deposits or withdrawals
- arbitrary contract calls

## Coop State

Each coop may optionally carry a `greenGoods` state block with:
- enablement and lifecycle status
- requested, provisioning, linked, and error timestamps
- linked `gardenAddress` and `tokenId`
- desired profile fields: name, description, location, banner image, metadata
- desired governance fields: `openJoining`, `maxGardeners`, `weightScheme`
- inferred Green Goods domains and computed `domainMask`
- last sync timestamps for profile, domains, and pools
- last transaction hash and last error

The state is included in:
- live coop state
- coop bootstrap snapshot
- invite bootstrap snapshot

## Action Classes

Phase 1 introduces these bounded Green Goods action classes:
- `green-goods-create-garden`
- `green-goods-sync-garden-profile`
- `green-goods-set-garden-domains`
- `green-goods-create-garden-pools`

All four are non-financial. They still flow through:
- action bundle creation
- approval policies
- digest verification
- replay protection
- trusted-node execution
- action log and operator log

## Agent Triggers

Two Green Goods-specific observation triggers are added:
- `green-goods-garden-requested`
- `green-goods-sync-needed`

Trigger sources:
- coop creation with Green Goods enabled emits `green-goods-garden-requested`
- a linked garden missing profile/domain/pool sync emits `green-goods-sync-needed`

## Skills

Phase 1 ships two bundled skills:

### `green-goods-garden-bootstrap`
- Trigger: `green-goods-garden-requested`
- Role: prepare a deterministic garden bootstrap payload from coop state
- Output: `green-goods-garden-bootstrap-output`
- Allowed action: `green-goods-create-garden`

### `green-goods-garden-sync`
- Trigger: `green-goods-sync-needed`
- Role: prepare deterministic sync data for profile, domains, and pools
- Output: `green-goods-garden-sync-output`
- Allowed actions:
  - `green-goods-sync-garden-profile`
  - `green-goods-set-garden-domains`
  - `green-goods-create-garden-pools`

These skills are marked `auto-run-eligible`, but they still depend on:
- anchor mode being active
- the action policy allowing execution without approval
- a trusted member context being available

## Execution Model

Green Goods uses the same trusted-node split as the rest of the agent harness:
- background detects and persists observations
- offscreen runtime runs the agent loop
- background executes approved action bundles

Execution mode rules:
- `mock`: use deterministic local results so demos and tests keep working offline
- `live`: reconstruct the existing coop Safe via passkey + Pimlico and submit bounded transactions

Live transaction targets:
- `GardenToken.mintGarden`
- `GardenAccount.updateName`
- `GardenAccount.updateDescription`
- `GardenAccount.updateLocation`
- `GardenAccount.updateBannerImage`
- `GardenAccount.updateMetadata`
- `GardenAccount.setOpenJoining`
- `GardenAccount.setMaxGardeners`
- `ActionRegistry.setGardenDomains`
- `GardensModule.createGardenPools`

## WebLLM And Determinism

Phase 1 uses deterministic and heuristic outputs for garden management. This is deliberate.

Reason:
- low-risk onchain execution should compile from constrained state, not free-form model output
- WebLLM remains appropriate for planning and richer synthesis work
- hardcoded Green Goods skills are safer for garden lifecycle actions than open-ended prompt execution

Planned next use of WebLLM:
- garden metadata drafting
- assessment drafting
- work approval routing
- structured non-financial attestations that compile into fixed EAS builders

## Policy Matrix

Recommended default policy posture:
- `green-goods-create-garden`: approval required by default
- `green-goods-sync-garden-profile`: approval required by default
- `green-goods-set-garden-domains`: approval required by default
- `green-goods-create-garden-pools`: approval required by default

Trusted operators can selectively relax these in the Operator Console for bounded autonomous execution.

## Phase 2

Phase 2 extends the Green Goods slice with deterministic, non-financial protocol actions:
- `green-goods-submit-work-approval`
- `green-goods-create-assessment`
- `green-goods-sync-gap-admins`

Execution model:
- work approvals and assessments enter Coop as explicit structured requests
- the agent harness turns those requests into validated observations and deterministic skill outputs
- GAP admin sync is both auto-detected from coop membership drift and manually queueable
- all three still compile into the existing action bundle, policy, approval, and replay-protection path

Safety posture:
- `green-goods-sync-gap-admins` is auto-run-eligible when anchor mode and policy allow it
- `green-goods-submit-work-approval` and `green-goods-create-assessment` remain proposal-first by default
- no IPFS upload, token movement, approvals, or arbitrary contract calls are introduced in Coop phase 2
- assessment requests require a precomputed `assessmentConfigCid`; Coop does not synthesize that JSON onchain payload itself in this phase
