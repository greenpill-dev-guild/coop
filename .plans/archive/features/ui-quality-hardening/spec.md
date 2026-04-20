# UI Quality Hardening

**Feature**: `ui-quality-hardening`
**Status**: Active
**Source Branch**: `refactor/ui-quality-hardening`
**Created**: `2026-03-26`
**Last Updated**: `2026-03-26`

## Summary

Keep the extension UI stable and polishable by focusing only on the remaining visual-regression drift and token-discipline gaps in the shipped popup and sidepanel surfaces.

## In Scope

- visual snapshot drift in current popup and sidepanel flows
- CSS token cleanup in already-shipped surfaces
- small surface-local cleanup when it directly improves visual confidence or token consistency

## Out Of Scope

- rebuilding visual-test infrastructure that already exists
- reopening broad refactors that already landed
- unrelated product or flow redesign outside popup and sidepanel quality work
