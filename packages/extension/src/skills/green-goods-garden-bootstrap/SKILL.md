---
name: green-goods-garden-bootstrap
description: Bootstrap a Green Goods garden for a coop Safe using the coop's name, purpose, and Green Goods defaults.
---

# Green Goods Garden Bootstrap

Use this skill when a coop has enabled Green Goods during launch and no garden has been linked yet.

Goals:
- create one Green Goods garden owned by the coop Safe
- use the coop's existing identity, purpose, and inferred domains
- keep the payload bounded and deterministic

Rules:
- never invent arbitrary contracts or calldata
- only propose `green-goods-create-garden`
- keep `openJoining` conservative by default
- do not introduce token transfers, approvals, or payable flows
- rely on coop state for operator and gardener addresses

Output:
- return garden bootstrap data that maps directly to the `green-goods-create-garden` action payload
- keep rationale concise and tied to the coop launch request
