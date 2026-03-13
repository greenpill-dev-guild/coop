# React Flow Context (Reference-Only)

Date: 2026-03-13
Status: reference only (scope guard)

## Why this file exists

React Flow remained in `origin/release/0.0`, but with bounded intent. This file records that intent so humans and agents keep v1 scope disciplined.

## Current release/0.0 status

React Flow is still present in release/0.0 references and implementation, including:

- app board surface (`packages/app/src/views/Board/*`)
- related tests and docs references

## Scope boundary for v1

Treat React Flow as a **read/presentation surface first**.

Avoid broad editing-canvas expansion unless scope is intentionally reopened and planned.

## Archive pointers for broader React Flow planning

Pre-alignment planning references are preserved in:

- Archive branch: `archive/pre-align-release-0.0-20260313-110510`
- Archive tag: `archive-pre-align-release-0.0-20260313-110510`
- Git bundle: `.archives/git/archive-pre-align-release-0.0-20260313-110510.bundle`

Examples in archived plans include:

- `.cursor/plans/09-hackathon-vnext.md`
- `.cursor/plans/CANVAS_DESIGN_SYSTEM.md`

## Reintroduction guide (if scope expands)

1. Keep a clear read-only vs editable boundary in requirements.
2. Gate editing features behind explicit milestones.
3. Add dedicated validation suites before enabling interactive editing defaults.
4. Update architecture docs and this file when status changes.
