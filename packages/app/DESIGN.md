---
version: alpha
name: Coop App Design Index
description: Routing guide for Coop app-surface DesignMD dialects. The installed receiver PWA and public website are separate overlays on the Coop core design system.
extends: ../../DESIGN.md
surface: app
dialects:
  pwa: packages/app/DESIGN.pwa.md
  browser: packages/app/DESIGN.browser.md
---

# Coop App — Design Index

The app package serves two experiences from one codebase. Do not prompt, review, or implement app UI from this index alone; pair the root `DESIGN.md` with the dialect file that matches the surface.

| Dialect | Detection | Audience | Design File | Navigation |
|---------|-----------|----------|-------------|------------|
| Installed PWA | `display-mode: standalone`, iOS standalone, share target, or explicit receiver route | Members capturing context from their phone | `packages/app/DESIGN.pwa.md` | Receiver shell with Mate, Hatch, and Roost actions |
| Public browser | Standard desktop or mobile browser visit | Community organizers, prospective members, partners | `packages/app/DESIGN.browser.md` | Website navigation, public sections, and community setup calls to action |

Hard rule: Browser = website. Installed PWA = pocket receiver tool. Never mix the public website hero/navigation system into the installed PWA, and never show receiver-first app chrome as the default for normal mobile browser visitors.
