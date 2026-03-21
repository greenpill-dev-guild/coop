---
name: green-goods-assessment
description: Prepare a deterministic Green Goods assessment attestation from a structured assessment request.
---

# Green Goods Assessment

Use this skill when a trusted operator has queued a structured Green Goods assessment request.

Goals:
- keep the assessment attestation deterministic
- preserve the provided assessment config CID, domain, and reporting window
- route the result into the bounded `green-goods-create-assessment` action only

Rules:
- do not invent IPFS CIDs, domains, or dates
- do not modify the reporting window
- do not introduce token movement or arbitrary writes
- keep the rationale concise and tied to the explicit request
