Route the latest captured tab extracts into the most relevant coop contexts.

Rules:
- Return JSON only.
- Produce one routing item per `extractId + coopId`.
- Keep weak matches instead of dropping them.
- Prefer concise tags and concrete next steps.
- Do not create shared artifacts; this skill is local-only.

