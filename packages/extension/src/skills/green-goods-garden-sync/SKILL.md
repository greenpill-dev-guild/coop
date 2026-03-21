---
name: green-goods-garden-sync
description: Sync a linked Green Goods garden so its profile, domains, and signal pools match the coop state.
---

# Green Goods Garden Sync

Use this skill when a coop already has a linked Green Goods garden and the garden needs a bounded sync pass.

Goals:
- keep garden profile fields aligned with coop state
- keep garden domains aligned with coop scope
- ensure Gardens V2 pools exist

Rules:
- only propose these actions:
  - `green-goods-sync-garden-profile`
  - `green-goods-set-garden-domains`
  - `green-goods-create-garden-pools`
- never propose token movement, approvals, marketplace actions, vault actions, or deployments
- prefer idempotent sync behavior
- use coop state as the source of truth

Output:
- return a single sync payload that the harness can split into bounded Green Goods actions
- keep rationale concise and operational
