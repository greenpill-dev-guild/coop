# ADR-009: Agentic Development Friction in the Coding Loop

**Status**: Accepted
**Date**: 2026-04-18
**Decision makers**: Coop team

## Context

Claude Code, Codex, and related agent workflows have changed the limiting factor in this repo.
Code generation is no longer the scarce resource. Review attention, architectural judgment, and
shared understanding are.

Coop already has strong pieces of an agent-friendly workflow:

- scoped feature packs in `.plans/features/<feature-slug>/`
- explicit lane ownership for Claude and Codex
- systematic review via `.claude/skills/review/SKILL.md`
- post-agent regression review before commit
- barrel-import and package-boundary rules that reduce hidden coupling

What remained too implicit was where friction should increase rather than decrease. Agent output can
create large diffs, silent fallbacks, duplicated patterns, and blurred ownership faster than humans
can responsibly review them. The practical risk is not only bad code. It is also psychological:
humans stop thinking at exactly the moment judgment matters most.

This ADR formalizes a coding-loop operating model for agent-heavy development in this repo,
informed by:

- Armin Ronacher and Cristina Poncela Cubeiro, "The Friction Is Your Judgment" (AI Engineer Europe,
  April 10, 2026)
- Armin Ronacher's 2025-2026 writing on agentic coding, review, and agent design
- Earendil / Pi / OpenClaw public material on small cores, explicit review callouts, and agent
  extensibility

## Decision

### 1. Optimize for scarce human attention

The repo treats agent output as abundant and human attention as scarce, especially during review,
handoff, and boundary decisions.

Large diffs are not a sign of efficiency on their own. They are often a sign that judgment has been
deferred too long.

### 2. Keep work inside small owned surfaces

Lane ownership and `owned_paths` are part of the coding architecture, not bookkeeping.

- Work should stay inside the smallest owned surface that can solve the task.
- If implementation spills across ownership boundaries, split the work or justify the spillover in
  handoff notes and review.
- Diffs that blur lane ownership are workflow problems even when they are technically correct.

### 3. Separate mechanical fixes from judgment calls

Mechanical issues should be easy for agents to repair:

- style and formatting violations
- localized type errors
- narrow rule violations
- missing or incorrect tests for a well-specified behavior
- obvious duplication in the touched slice

Judgment-heavy changes must be explicitly surfaced for human attention, even when the code "works."
These are **human judgment callouts**:

- new dependencies
- schema, migration, Dexie, Yjs, CRDT, or persisted-state changes
- auth, permissions, session, permit, policy, or approval-flow changes
- destructive or irreversible operations
- public API, export-surface, or cross-package contract changes
- build, model, provider, runtime, or toolchain boundary changes
- large diffs, overlapping ownership, or blurred lane boundaries

Review surfaces must show these callouts separately from normal bug findings.

### 4. Prefer explicit behavior over hidden magic

Agent-written code tends to overvalue local progress. The coding loop should push back by preferring
visible intent over hidden recovery.

- Prefer explicit failure over silent fallback when missing config or invalid state would create
  hidden corruption.
- Avoid bare catch-alls and recovery paths that hide intent or suppress important failures.
- Avoid hidden magic that a reviewer or implementation agent cannot easily discover from local code.
- Keep important behavior legible through shared instructions, lane metadata, review output, and
  handoff notes.

### 5. Embed the discipline in the coding loop

The repo should express this discipline through the existing loop surfaces:

- global repo instructions (`AGENTS.md`, `CLAUDE.md`)
- implementation and migration agent prompts
- planning guidance and lane templates
- advisory hooks that surface judgment-heavy files or ownership drift
- review protocols and output contracts

Review remains the strongest friction point, but it should not be the only place where the loop
remembers these rules.

### 6. Keep merge-time enforcement light in v1

This ADR does not change Coop's product runtime, browser-native harness, Planning OS, or merge-time
CI rules.

The v1 rollout is intentionally light-touch:

- one ADR for rationale
- repo and agent instructions
- planning and handoff guidance
- advisory hooks
- reviewer and migration contracts

No new CI-blocking gate is introduced in this decision.

## Consequences

**Positive:**

- clearer handoff between agent-autofix work and human decision work
- less risk of rubber-stamped dependencies, migrations, and permission changes
- better alignment between lane ownership and actual code changes
- more early warnings when edits enter judgment-heavy files or hidden-magic territory
- better back-pressure against giant mixed diffs without hard thresholds
- more explicit loop ergonomics for Claude and Codex

**Negative:**

- more process friction around changes that previously looked "done"
- reviews may take longer because some work is intentionally escalated to humans
- agent prompts and handoff notes become more structured, which may feel heavier at first

## Alternatives Considered

**Keep current process and rely on reviewer intuition**: Rejected. The repo already had good review
machinery, but critical judgment points were still implicit and easy to skip.

**Maximize automation and remove human gates where possible**: Rejected. This would optimize for
throughput at the exact points where technical debt, security drift, and brittle abstractions are
most likely to compound.

**Limit the change to documentation only**: Rejected. The operating model needs enforcement in
review prompts and output contracts, otherwise it remains aspirational.

**Keep this confined to review only**: Rejected. Review is the strongest friction point, but the
coding loop also needs the same discipline in agent prompts, planning, handoff, and advisory hooks.

## References

- The Friction Is Your Judgment: https://mitsuhiko.github.io/talks/ai-engineer-talk/
- Earendil press release: https://earendil.com/posts/press-release-april-8th/
- Agentic Coding Recommendations: https://lucumr.pocoo.org/2025/6/12/agentic-coding/
- Agentic Coding Things That Didn't Work: https://lucumr.pocoo.org/2025/7/30/things-that-didnt-work/
- Agent Design Is Still Hard: https://lucumr.pocoo.org/2025/11/21/agents-are-hard/
- A Language For Agents: https://lucumr.pocoo.org/2026/2/9/a-language-for-agents/
- Pi: The Minimal Agent Within OpenClaw: https://lucumr.pocoo.org/2026/1/31/pi/
