---
version: alpha
name: Coop Core
description: "Core warm-earth Coop design language for shared brand, tokens, tone, and component patterns across app, website, extension, and docs surfaces."
colors:
  primary: "#4f2e1f"
  on-primary: "#ffffff"
  secondary: "#5a7d10"
  on-secondary: "#fffaf3"
  tertiary: "#fd8a01"
  neutral: "#fcf5ef"
  surface: "#fcf5ef"
  surface-card: "#fffcf9"
  surface-strong: "#ffffff"
  field: "#fffbf7"
  mist: "#d8d4d0"
  on-surface: "#27140e"
  text-soft: "#6b4a36"
  error: "#a63b20"
typography:
  headline-display:
    fontFamily: "Gill Sans, Trebuchet MS, sans-serif"
    fontSize: 5.9rem
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: "Gill Sans, Trebuchet MS, sans-serif"
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: -0.02em
  headline-md:
    fontFamily: "Gill Sans, Trebuchet MS, sans-serif"
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.01em
  body-lg:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.45
  body-md:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.5
  label-lg:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 0.88rem
    fontWeight: 700
    lineHeight: 1.2
  label-md:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 0.78rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.12em
  mono-sm:
    fontFamily: "SFMono-Regular, JetBrains Mono, monospace"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.5
rounded:
  xs: 6px
  sm: 8px
  icon: 10px
  chip: 12px
  button: 14px
  input: 16px
  photo: 18px
  card: 24px
  card-lg: 28px
  card-xl: 30px
  pill: 999px
spacing:
  micro: 0.15rem
  tiny: 0.2rem
  xs: 0.35rem
  sm: 0.65rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  section: 4rem
  max-content: 1120px
components:
  page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
  app-bar:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.card}"
    padding: 1rem
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card-xl}"
    padding: 1.4rem
  elevated-card:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: 1rem
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    padding: 0.75rem
    height: 48px
  button-secondary:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.button}"
    padding: 0.75rem
    height: 44px
  active-tab:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.input}"
    padding: 0.7rem
  chip:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    padding: 0.35rem
  success-badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    padding: 0.3rem
  attention-badge:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.pill}"
    padding: 0.3rem
  input-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.button}"
    padding: 0.8rem
  helper-text:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.text-soft}"
    typography: "{typography.body-sm}"
  notification:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.chip}"
    padding: 0.5rem
  tooltip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.icon}"
    padding: 0.5rem
  error-state:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.chip}"
    padding: 0.5rem
---

# Coop Core Design System

## Overview

Coop should feel warm, observant, local-first, and useful: a knowledge companion that notices scattered context, helps members sort what matters, and turns fragments into shared memory without feeling like surveillance. The visual language is rooted in the chicken mark, garden/nest metaphors, warm paper surfaces, earthy browns, growth greens, and bright orange action moments.

This file is the canonical Coop core DesignMD source. Use it with the surface dialect that matches the work: `packages/app/DESIGN.pwa.md` for the installed receiver PWA, `packages/app/DESIGN.browser.md` for the public website, and `docs/DESIGN.md` for documentation. Extension UI inherits this core file until an extension-specific dialect exists.

The shipped runtime token source remains `packages/shared/src/styles/tokens.css`; when a token changes, update this file and the runtime CSS together. Docs mirror a subset in `docs/src/css/custom.css`.

## Colors

- **Primary / Coop Brown (#4f2e1f):** Primary text, wordmark color, dense UI chrome, filled primary actions, and serious governance/review surfaces.
- **Secondary / Coop Green (#5a7d10):** Knowledge, growth, accepted state, active routing, source health, and calm positive emphasis.
- **Tertiary / Coop Orange (#fd8a01):** Publish/archive emphasis, review-needed badges, recording or action attention, and small celebratory sparks.
- **Neutral / Coop Cream (#fcf5ef):** Default page background, sidepanel base, docs background, and warm empty-state foundation.
- **Surface Card (#fffcf9):** Card and panel base; often rendered with light alpha over cream in CSS.
- **Mist (#d8d4d0):** Quiet dividers, inactive badges, compact member pips, and neutral icon backplates.
- **On Surface / Ink (#27140e):** High-contrast headlines and strong text when primary brown is not enough.
- **Text Soft (#6b4a36):** Secondary text, helper copy, metadata, captions, and low-priority affordances.
- **Error (#a63b20):** Errors, destructive action warnings, offline states, and failed validation.

Use warm translucency rather than cold gray overlays. Green and orange should be sparse signals, not competing brand colors on every component.

## Typography

- **Headlines:** `Gill Sans`, falling back to `Trebuchet MS`, should feel friendly and slightly rounded. Use large, tight display type on landing and docs hero moments.
- **Body:** `Avenir Next`, falling back to `Trebuchet MS` and `Segoe UI`, should carry most app, extension, receiver, and docs content.
- **Labels:** Use the body family at bold weights with uppercase letter spacing for eyebrows, metadata labels, route labels, and small state text.
- **Code and technical values:** Use `SFMono-Regular` or `JetBrains Mono` for pairing codes, URLs, hashes, receipts, and archive identifiers.
- **Restraint:** The logo carries the most personality. Do not add decorative typefaces or ultra-thin futuristic UI fonts.

## Layout

- Use `1120px` as the default max-width for public website and docs content, with `1rem` mobile gutters.
- Use the shared spacing scale from `packages/shared/src/styles/tokens.css`: `0.15rem`, `0.2rem`, `0.35rem`, `0.65rem`, `1rem`, `1.5rem`, and `2rem`.
- Public and docs pages can be atmospheric: radial green/orange glows, a subtle 52px grid, sticky visual scenes, and generous section spacing.
- Runtime surfaces should be denser: compact grids, clear tab rows, visible review counts, and cards that scan quickly.
- Receiver PWA flows should feel tactile and ceremonial, especially capture, pairing, and successful handoff states.
- Keep the hierarchy review-first: what needs attention, what changed, what can be published, and what stays private should be visually obvious.
- Surface dialect files may tighten navigation, route, and copy rules, but they should not redefine the core brand without an explicit token update here.

## Elevation & Depth

- Coop uses tonal layers, warm alpha surfaces, 1px brown lines, and soft shadows instead of heavy drop shadows.
- Primary shadows are `0 8px 20px`, `0 16px 40px`, and `0 24px 60px` using low-alpha brown.
- Use `backdrop-filter: blur(10px-12px)` only for sticky headers, floating panels, and cards that need to sit above atmospheric backgrounds.
- Hover lift should be small: `translateY(-1px)` or `translateY(-2px)` with a slightly stronger shadow.
- Dark mode keeps the same semantic roles with warmer dark browns, not generic black panels or blue accents.

## Shapes

- Cards and panels are soft and nest-like: use 24px to 30px radii for primary content containers.
- Buttons are rounded but not fully pill-shaped in dense UI: use the 14px button radius unless the component is explicitly a tag or CTA chip.
- Chips, badges, and state pills use full pill radii.
- Inputs and textareas use 14px to 16px radii, clear borders, and warm field backgrounds.
- Icon buttons use compact 10px rounded squares, not circular generic toolbar buttons.
- The receiver capture egg can break the rectangle system; keep that shape special to capture/recording moments.

## Components

- **Buttons:** Primary actions are brown filled with white text. Secondary actions use white or warm surface fills with brown text and a visible border. Inline actions can use soft green backgrounds for knowledge or sync affordances.
- **Cards:** `nest-card`, `panel-card`, `draft-card`, `artifact-card`, and receiver cards should use warm translucent surfaces, brown borders, and light elevation. Avoid cold white slabs.
- **Tabs and routes:** Active tabs use green or brown emphasis depending on surface density. Route labels should stay legible at compact sidepanel widths.
- **Badges and chips:** Green means accepted, active, synced, or healthy. Orange means needs review, publishing, recording, or important attention. Brown/neutral means metadata.
- **Forms:** Labels are bold, fields are warm, helper text is soft brown, and errors must be visible in both color and copy.
- **Notifications:** Keep banners compact, warm, and dismissible. Use orange borders for attention without turning every notification into an alarm.
- **Tooltips:** Tooltips are compact, high-contrast, and functional. They should explain confidence, provenance, or disabled states, not restate visible labels.
- **Brand assets:** Use `coop-wordmark-flat.png` for mastheads and normal chrome. Use `coop-mark-glow.png` and `coop-wordmark-glow.png` only for hero, onboarding, and success states.
- **Icon states:** Idle is neutral, watching uses subtle green, review-needed uses orange, and error/offline uses reduced saturation plus explicit text.
- **Motion:** Use `coop-rise` style reveals, small hover lift, gentle pulses for new review items, and ceremonial bloom only for creation or successful publish moments.

## Do's and Don'ts

- Do use `packages/shared/src/styles/tokens.css` before introducing new runtime values.
- Do pair this file with the matching surface dialect before designing or implementing PWA, website, or docs screens.
- Do keep Coop warm, inhabited, and useful rather than corporate, sterile, or cold.
- Do make passive observation feel consentful and reviewable: "noticed", "ready for review", and "publish" states must be clear.
- Do preserve product nouns like Popup, Chickens, Coops, Roost, Nest, Receiver, drafts, artifacts, and publish prep when designing new screens.
- Do maintain WCAG AA contrast for normal text and never rely on color alone for errors, publish states, or sync/offline status.
- Do let website/docs be more atmospheric and let installed app/runtime surfaces be more functional.
- Don't prompt surface-specific app or docs work from this core file alone.
- Don't use generic SaaS blue, purple gradients, cold grayscale dashboards, or glassmorphism that hides the warm paper/nest feel.
- Don't make the chicken personality too cute in core review or governance flows; keep playfulness in success states, iconography, and copy edges.
- Don't add package-local design tokens or package-specific style systems. New shared visual rules belong in shared tokens and this file.
- Don't create new component primitives before checking `packages/extension/src/views/shared/`, `packages/app/src/components/`, and existing global CSS patterns.
