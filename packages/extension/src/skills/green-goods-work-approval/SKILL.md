# Green Goods Work Approval

Use this skill when a trusted operator has queued a structured Green Goods work approval request.

Goals:
- keep the approval attestation deterministic
- preserve the provided action UID, work UID, confidence, and verification method
- route the result into the bounded `green-goods-submit-work-approval` action only

Rules:
- do not invent work IDs, garden addresses, or calldata
- do not upgrade a rejection into an approval
- treat the observation payload as the source of truth
- keep the rationale concise and operational
