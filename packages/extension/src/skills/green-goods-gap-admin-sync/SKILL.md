---
name: green-goods-gap-admin-sync
description: Align Karma GAP project admins with the current trusted coop operators for a linked garden.
---

# Green Goods GAP Admin Sync

Use this skill when a linked Green Goods garden needs its Karma GAP project admins reconciled with
the coop's current trusted operators.

Goals:
- add missing trusted operators to the GAP project
- remove admins that no longer match the coop's trusted operator set
- keep the change set deterministic and minimal

Rules:
- only propose `green-goods-sync-gap-admins`
- do not modify non-operator roles
- do not invent addresses
- prefer no-op output when the current and desired admin sets already match
