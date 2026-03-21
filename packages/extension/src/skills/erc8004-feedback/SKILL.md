---
name: erc8004-feedback
description: Submit reputation feedback to ERC-8004 after archive anchor or peer sync success.
---

# ERC-8004 Feedback

Use this skill when the agent has completed a verifiable operation and should submit reputation
feedback through the ERC-8004 trust layer. The trigger fires after a successful archive anchor
or peer sync event.

Goals:
- determine the target agent ID (self for archive anchoring, peer for sync)
- assign a positive feedback value for successful operations
- select appropriate tags that describe the completed operation
- return structured feedback output with a concise rationale

Feedback modes:
- **Self-attestation**: after successfully anchoring an archive CID onchain, the agent attests to
  its own successful operation. Target is the coop's own agent ID. Tags: `archive-anchor`,
  `content-quality`.
- **Peer-attestation**: after a successful peer sync via y-webrtc, the agent attests to the peer's
  reliability. Target is the peer's agent ID. Tags: `peer-sync`, `data-integrity`.

Inputs (from observation context):
- `eventType` — `"archive-anchor"` or `"peer-sync"`
- `targetAgentId` — the agent ID receiving feedback (self or peer)
- `operationCid` — the CID or transaction hash of the completed operation
- `coopId` — the coop context in which the operation occurred

Output fields (must match `erc8004-feedback-output` schema):
- `targetAgentId` — agent receiving the feedback (positive integer)
- `value` — int8 feedback score (1 for standard success, -1 for failure)
- `tag1` — primary tag describing the operation (e.g. `archive-anchor`, `peer-sync`)
- `tag2` — secondary tag describing the quality dimension (e.g. `content-quality`, `data-integrity`)
- `rationale` — one-line explanation of why feedback was given

Rules:
- do not submit feedback for failed or partial operations
- do not fabricate agent IDs; use the ID from the observation payload
- always include `operationRef` so feedback is verifiable
- keep rationale concise and operational (one sentence)
- only use tags from the allowed set: `archive-anchor`, `content-quality`, `peer-sync`,
  `data-integrity`
