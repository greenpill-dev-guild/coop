---
version: alpha
name: Coop Docs Dialect
description: Documentation-site overlay for the Coop core DesignMD tokens. Preserves the Docusaurus reading and reference surface.
extends: ../DESIGN.md
surface: docs
dialect: documentation
typography:
  doc-title:
    fontFamily: "Gill Sans, Trebuchet MS, sans-serif"
    fontSize: 2.375rem
    fontWeight: 700
    lineHeight: 1.12
  doc-section:
    fontFamily: "Gill Sans, Trebuchet MS, sans-serif"
    fontSize: 1.875rem
    fontWeight: 700
    lineHeight: 1.18
  body-md:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
  body-strong:
    fontFamily: "Avenir Next, Trebuchet MS, Segoe UI, sans-serif"
    fontSize: 1rem
    fontWeight: 700
    lineHeight: 1.6
  code:
    fontFamily: "SFMono-Regular, JetBrains Mono, monospace"
    fontSize: 0.92rem
    fontWeight: 500
    lineHeight: 1.6
colors:
  primary: "#4f2e1f"
  secondary: "#6b4a36"
  background: "#fcf5ef"
  surface: "#fffcf9"
  code-surface: "#fff8f2"
  text: "#27140e"
  link: "#5a7d10"
  accent: "#fd8a01"
rounded:
  sm: 8px
  md: 16px
  lg: 24px
spacing:
  sm: 0.65rem
  md: 1rem
  lg: 1.5rem
components:
  doc-page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
  doc-heading:
    textColor: "{colors.primary}"
    typography: "{typography.doc-title}"
  metadata-label:
    textColor: "{colors.secondary}"
    typography: "{typography.body-strong}"
    padding: "{spacing.sm}"
  callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  code-block:
    backgroundColor: "{colors.code-surface}"
    textColor: "{colors.text}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  doc-link:
    textColor: "{colors.link}"
    typography: "{typography.body-strong}"
  warning-callout:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
---

# Coop Docs — Design Brief

> Documentation dialect for Docusaurus pages. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Surface | Audience | Metaphor | Paradigm | Navigation |
|---------|----------|----------|----------|------------|
| **Docs** | Builders, operators, community organizers, reviewers, and contributors | Calm coop field manual | Readable reference surface | Docusaurus navbar, sidebar, article body, and table of contents |

**Hard rule:** Docs stay docs. Preserve Docusaurus structure, long-form readability, compact reference patterns, and clear sidebars. Do not import installed-PWA receiver chrome or public website campaign sections unless the docs home explicitly needs a short orientation moment.

## Colors

- Docs inherit the root Coop warmth while staying quieter than the public website.
- Cream and warm paper surfaces carry the reading canvas.
- Brown carries headings, navigation text, and durable reference structure.
- Green is for links, active nav, success, and builder wayfinding.
- Orange is reserved for warnings, important notes, and high-attention callouts.

## Typography

- Display headings use the root Coop display family but should be smaller and steadier than website heroes.
- Body copy favors long-form readability with generous line height and short paragraphs.
- Code, commands, package paths, env vars, hashes, and config keys use the mono family.
- Avoid decorative type treatments that make docs feel like a campaign page.

## Layout

- Preserve the Docusaurus navbar, sidebar, article content, and table-of-contents rhythm.
- Keep article content comfortable for reading; avoid full-width prose.
- Tables and diagrams should scroll or wrap gracefully instead of forcing the page wider.
- Builder and environment pages should prioritize exact commands, package paths, and current repo boundaries.
- The docs home may have a concise opening hero, but interior docs should remain reference-first.

## Elevation & Depth

- Use subtle paper layers, low-alpha borders, and compact callouts.
- Do not add heavy shadows or app-like stacked cards to long-form reference pages.
- Code blocks and admonitions should be distinct without overpowering the article text.

## Shapes

- Use modest radii for code, tables, and callouts so reference content stays crisp.
- Larger card radii can appear on docs landing/index pages, but article pages should remain compact.
- Avoid PWA egg/capture shapes unless documenting that component directly.

## Components

- **Navbar and sidebar:** Keep Docusaurus conventions and active states grounded in green or brown.
- **Callouts:** Use for prerequisites, warnings, decisions, and next actions; keep them short.
- **Code blocks:** Show exact commands and preserve copyability.
- **Tables:** Use for environment variables, route maps, package boundaries, and validation tiers.
- **Screenshots and diagrams:** Prefer real product screenshots and source-backed diagrams over decorative illustrations.

## Do's and Don'ts

- Do keep docs calm, instructional, and source-aware.
- Do ground docs visuals in `docs/src/css/custom.css` and the root Coop tokens.
- Do name the surface being documented when examples cross website, PWA, extension, or API boundaries.
- Do use exact commands like `bun run test`, package names, and current route names.
- Don't use installed-PWA Mate/Hatch/Roost chrome as the docs navigation frame.
- Don't use oversized public website hero treatment on normal reference pages.
- Don't blur current behavior with aspirational design language unless the docs explicitly mark it as future work.
