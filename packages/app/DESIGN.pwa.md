---
version: alpha
name: Coop Installed PWA Dialect
description: Phone-first receiver overlay for the Coop core DesignMD tokens.
extends: ../../DESIGN.md
surface: app-pwa
dialect: receiver-pwa
---

# Coop Receiver PWA — Design Brief

> Installed PWA creative direction for the phone-based Coop receiver. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audience | Metaphor | Paradigm | Navigation |
|------|-----------|----------|----------|----------|------------|
| **Installed PWA** | `display-mode: standalone`, iOS standalone, share target, or explicit receiver route | Coop members capturing links, files, photos, audio, and quick notes | Pocket field journal crossed with a hatching tray | Capture-first local tool | Receiver shell: Mate, Hatch, Roost |

**Hard rule:** Installed PWA = app. It is not the marketing website and should not use public website hero chrome, desktop nav, or long-form campaign sections.

## Colors

- Inherit Coop Brown, Coop Green, Coop Orange, Cream, and warm surface tokens from the root design file.
- Brown carries trust, pairing, identity, and review control.
- Green carries healthy sync, accepted handoff, active coop context, and local-first reassurance.
- Orange carries capture attention, recording, publish/archive emphasis, and moments that need review.
- Offline, disconnected, or retrying states should feel calm and recoverable before they feel alarming.

## Typography

- Use the root display family for brief orientation moments only: Mate, Hatch, Roost, successful pairing, and completed handoff.
- Use body and label styles for most controls, queue items, receiver metadata, URLs, hashes, and sync notes.
- Keep line lengths short on phones. Prefer one clear instruction, one primary action, and one recovery path per screen.
- Pairing codes, archive IDs, and sync details use the mono style for scannability.

## Layout

- Design mobile-first for 360px to 430px wide screens, then scale up gracefully for tablet or desktop standalone windows.
- Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` around sticky controls, install prompts, and capture actions.
- Primary actions should sit in reachable thumb zones. Avoid burying capture, retry, or send actions at the top edge.
- Mate is for pairing and trust setup, Hatch is for active capture, and Roost is for received or queued items.
- Explicit receiver routes such as `/pair`, `/receiver`, and `/inbox` remain usable in normal browsers for QR links, testing, and recovery, but they do not define the default public website entry.

## Elevation & Depth

- Use layered warm cards, soft brown borders, and small elevation instead of heavy mobile-app chrome.
- Capture controls may be more dimensional and egg-like than normal cards; keep that shape special.
- Install nudges should float lightly inside the receiver shell, not take over the screen.
- Sync banners should be persistent enough to trust but quiet enough not to block capture.

## Shapes

- Receiver cards use the root large card radii and should feel nest-like.
- Capture and recording controls may use egg or soft oval silhouettes.
- Pairing QR panels and code fields should stay square enough to scan cleanly.
- Thumb controls use button radii, not generic circular icon buttons unless the control is purely iconic.

## Components

- **Mate:** Pairing setup should make trust explicit: who is pairing, which coop is active, and what will sync.
- **Hatch:** Capture should be the clearest action on the screen, with immediate local feedback before any remote sync claim.
- **Roost:** Inbox and queued items should show status, source, retry, and remove actions without making users hunt.
- **Sync status:** Use plain language such as "Saved on this phone", "Ready to sync", "Syncing", and "Needs retry".
- **Install guidance:** Show only in browser receiver flows where install would help; installed PWA mode should not keep asking users to install.
- **Empty states:** Empty Mate, Hatch, and Roost states should teach the next action, not advertise the whole product.

## Do's and Don'ts

- Do make the PWA feel like a pocket field tool for coop members.
- Do optimize for one-handed capture, interruption, and recovery.
- Do treat offline/local saved states as first-class success states.
- Do make explicit what stays on-device versus what is sent to a coop.
- Don't use website hero sections, public route grids, or campaign copy inside receiver flows.
- Don't hide sync failures behind optimistic success messages.
- Don't make capture feel like filling out a form unless the user is editing details after the quick save.
