---
feature: hackathon-release-readiness
title: Hackathon release docs and story lane
lane: docs
agent: claude
status: done
source_branch: main
work_branch: claude/docs/hackathon-release-readiness
depends_on:
  - ../spec.md
tags:
  - Documentation
  - Demo
  - Strategy
skills:
  - docs
  - product
  - ui
updated: 2026-03-30
---

# Docs Lane

## Category

Documentation, release story, and builder-facing routing.

## Objective

Make it obvious how a builder installs Coop, make the demo flow easy to present, and give the
release a concise narrative without blocking on speculative strategy work.

## Files

- `packages/app/src/views/Landing/index.tsx`
- `packages/app/src/styles.css`
- `docs/builder/getting-started.md`
- `docs/builder/extension.md`
- `docs/reference/extension-install-and-distribution.md`
- `docs/reference/demo-and-deploy-runbook.md`
- `docs/community/pricing.md`
- `docs/community/road-ahead.md`
- new docs only if needed for demo story or roadmap narrative
- reference tone source: `/Users/afo/Code/greenpill/green-goods/packages/client`

## Tasks

- [ ] Make the builder install/download path obvious from the landing page and docs.
- [ ] Tighten unpacked-install and zip-distribution guidance so a first-time builder does not have
      to hunt.
- [ ] Write a clean demo storyboard covering landing, coop creation, synthesis, archive/Filecoin,
      Green Goods action, and the larger vision.
- [ ] If release-adjacent docs are green, add a concise outline for the four core tenets,
      monetization path, and future features.
- [ ] Mark any "Durgafas" framing as provisional unless the framework is supplied externally.

## Verification

- [ ] `bun run docs:build`
- [ ] landing links and docs routes checked manually

## Handoff Notes

- The install path and demo story are release-relevant.
- The monetization and future-features narrative is valuable but should not block the release
  candidate.
