# Implementation Notes For Agentic Flow Hardening

## What Changed

- Added the canonical `agentic-flow-hardening` feature pack and migrated the last flat landing polish note into `landing-closing-polish`.
- Added `Agent Readiness` to feature specs, a docs lane template, and schema/migration preflight prompts in implementation lanes.
- Added shared Zod contracts for ICE config responses, ICE rate-limit errors, and signaling messages.
- Updated API, WebSocket signaling, and shared ICE config fetch parsing to consume those contracts while preserving existing wire shapes.
- Added advisory `check:agentic-flow`, wired it into `agentic:check`, and hardened it after review to scan package source and tests with AST-based import extraction.
- Updated extension design guidance and app route context to reduce stale routing/CSS guidance.

## Why It Changed

- The first import-boundary pass needed to stay advisory, but review showed that advisory visibility is only useful if it catches common import forms and package-level tests.
- Existing QA templates had pass ownership drift. The hardening pass now keeps Codex QA pass 1 and Claude QA pass 2 aligned across templates and migrated packs.
- The app route table was corrected first, then adjacent app-context import and pairing-route wording was tightened so agents do not follow stale examples.

## Follow-Ups

- Consider wiring `check:agentic-flow --strict` into CI only after advisory output has been watched on several real feature packs.
- Run the normal sequential QA handoff branches before treating the pack as fully closed.
