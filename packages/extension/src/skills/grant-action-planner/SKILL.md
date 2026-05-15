---
name: grant-action-planner
description: Plan the next action for the top-scored grant opportunity using a Gemma 4 function call.
---

# Grant Action Planner

Pick the strongest scored opportunity in the latest fit-scorer pass, then call exactly one of:

- `draft_application_outline` — propose section headers for an application response.
- `add_to_coop_calendar` — surface the deadline so the coop sees it on the next review.
- `request_member_input` — name members whose context is needed before drafting.

Use the coop purpose, recent decisions, and any attached audio meeting context as fit signal. Keep
the rationale short and tied to the opportunity. The model is expected to emit exactly one
`<tool_call>` payload — the runner discards trailing prose.
