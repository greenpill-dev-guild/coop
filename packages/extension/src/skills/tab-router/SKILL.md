---
name: tab-router
description: Route newly captured extracts into local coop contexts, preserve weak matches, and seed local drafts for stronger matches.
---

Route the latest captured tab extracts into the most relevant coop contexts.

Rules:
- Return JSON only.
- Produce one routing item per `extractId + coopId`.
- Keep weak matches instead of dropping them.
- Prefer concise tags and concrete next steps.
- Do not create shared artifacts; this skill is local-only.
