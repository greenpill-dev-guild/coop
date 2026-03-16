---
title: "Audio & Asset Operations"
sidebar_label: "Audio & Assets"
sidebar_position: 4
---

# Coop Audio And Asset Operations

This document closes the operational gap between the Coop build plan and the design direction.

It defines where branding and audio assets live, how they should be sourced, how they should be named, and what rules the builder should follow when turning source assets into runtime assets for the landing page and extension.

## 1. Purpose

The Coop v1 docs already define:

- when sound should happen
- when sound should stay silent
- how playful the product should feel
- which branding assets should shape the landing page and extension

What was still missing was the practical layer:

- where source assets live in the repo
- which sound files are required for v1
- how to source those files responsibly
- how to track licensing and provenance
- how to package assets for runtime use

This document is the operational source of truth for those details.

## 2. Source-Of-Truth Folders

The repo should treat assets in two tiers.

### 2.1 Source Assets

These are the human-maintained originals and provenance-tracked files.

- branding source assets:
  `docs/assets/branding/`
- audio source assets:
  `docs/assets/audio/`

### 2.2 Runtime Assets

Once the app and extension are scaffolded, optimized runtime copies can live in package-level public/static folders.

Recommended runtime targets:

- landing page runtime assets:
  `packages/app/public/`
- extension runtime assets:
  `packages/extension/public/`

Do not treat package-level runtime copies as the archival source of truth.

## 3. Required V1 Audio Set

V1 only needs three sound moments.

### 3.1 Required Files

- `coop-rooster-call`
  Played when a coop is created successfully.
- `coop-soft-cluck`
  Played when a reviewed draft is successfully published.
- `coop-squeaky-test`
  Used only in settings as an explicit novelty sound test.

### 3.2 Explicitly Not Required

Do not block the build on extra sounds for:

- passive tab detection
- scheduled scans
- sync updates
- hover states
- minor notifications

The sound set should stay tiny.

## 4. File Formats And Naming

### 4.1 Source Format

Prefer lossless source files when possible.

- preferred source format: `.wav`
- acceptable source format when that is all that exists: `.aiff`

### 4.2 Runtime Format

Ship compressed runtime versions suitable for browser playback.

- preferred runtime format: `.mp3`
- optional secondary runtime format: `.ogg`

### 4.3 Naming Convention

Use lowercase, hyphenated, event-based file names.

Examples:

- `coop-rooster-call.wav`
- `coop-rooster-call.mp3`
- `coop-soft-cluck.wav`
- `coop-soft-cluck.mp3`
- `coop-squeaky-test.wav`

Avoid vague names such as:

- `success-sound-final.wav`
- `funnychicken2.mp3`
- `audio-new.mp3`

## 5. Sourcing Order

Use this priority order for v1.

### 5.1 Preferred

Create original sounds internally.

This can be:

- a simple recorded foley sound
- a designer-made sound
- a generated placeholder created specifically for Coop

This is the cleanest route because it minimizes licensing ambiguity and keeps the product identity coherent.

### 5.2 Acceptable

Use third-party sound effects only if the license is clearly compatible with hackathon demo use and future product iteration.

Recommended places to review first:

- [Pixabay sound effects](https://pixabay.com/sound-effects/)
- [Mixkit sound effects](https://mixkit.co/free-sound-effects/)

These are useful because they present simple, public-facing licensing terms, but the builder must still confirm the current license page at time of selection.

### 5.3 Use With Caution

Use library/community catalogs with per-file license variance only when the exact file license is captured in the asset manifest.

Example:

- [Freesound](https://freesound.org/)

Freesound is viable, but individual sounds may use different Creative Commons licenses. That means the exact file and license must be reviewed before it enters the repo.

For v1:

- `CC0` is acceptable
- `CC BY` is acceptable only if attribution can be tracked and honored
- `CC BY-NC` should be avoided for product assets

## 6. Licensing And Provenance Rules

Every external audio asset added to the repo should be tracked in an asset manifest.

At minimum, record:

- filename
- product event
- source URL
- source library
- creator/uploader name if available
- license at time of download
- whether attribution is required
- date added
- any edits made after download

### 6.1 Manifest Location

Track this in:

`docs/assets/audio/README.md`

### 6.2 V1 Safety Rule

If the license is unclear, skip the file.

Do not pull in assets with ambiguous commercial rights, unclear redistribution terms, or attribution requirements the team is unlikely to honor correctly during a fast hackathon cycle.

### 6.3 License Review Pages

At time of selection, confirm the current terms directly from the source library:

- [Pixabay content license summary](https://pixabay.com/service/license-summary/)
- [Mixkit license overview](https://mixkit.co/license/)
- [Freesound license FAQ](https://freesound.org/help/faq/)

These links should be treated as the review starting point, not as a substitute for checking the exact file page when a library uses per-item licensing.

## 7. Product Behavior Rules

The build should follow these behavior constraints:

- sounds are off for passive/background system activity
- sounds are allowed for explicit success moments
- the settings test sound is user-triggered only
- users must be able to mute all Coop sounds quickly
- reduced-motion and reduced-sound preferences must be respected

The product should feel alive, not noisy.

## 8. Landing Page And Extension Usage

### 8.1 Landing Page

The landing page may use:

- the wordmark flat asset in the masthead and hero
- glow variants in hero or ritual moments only
- no autoplay sound

### 8.2 Extension

The extension should use:

- flat logo assets for most interface chrome
- sound only on successful create/publish/test actions
- no sound on passive scans or quiet state transitions

## 9. Fallback Plan

If good licensed sounds are not found quickly:

1. ship with sound support implemented but muted by default
2. add a temporary internal placeholder for `coop-rooster-call`
3. keep `coop-soft-cluck` and `coop-squeaky-test` disabled until good assets exist
4. do not expand the sound set during the hackathon

The feature should never block the core loop.

## 10. Builder Checklist

Before shipping v1, confirm:

- the three required event sounds exist or are intentionally deferred
- every external sound has a tracked source and license record
- runtime copies are exported from source assets cleanly
- mute works
- reduced-motion/reduced-sound handling works
- landing page stays silent by default
- extension background activity stays silent by default

## 11. Implementation Note

The builder should treat sound as a small identity layer, not a subsystem.

If time gets tight, preserve:

- create success sound
- publish success sound
- settings test sound
- mute toggle

Cut everything else first.
