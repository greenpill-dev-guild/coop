---
version: alpha
name: Coop Public Browser Dialect
description: Public website overlay for the Coop core DesignMD tokens.
extends: ../../DESIGN.md
surface: app-browser
dialect: public-website
---

# Coop Public Website — Design Brief

> Browser creative direction for community organizers, prospective members, partners, and visitors. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|-----------|----------|----------|------------|
| **Public browser** | Standard desktop or mobile browser visit | Community organizers, prospective members, partners, and curious contributors | A warm town-hall table where scattered knowledge becomes shared action | Credible public story with playful coop cues | Website navigation, section anchors, and install/setup calls to action |

**Hard rule:** Browser = website. Desktop and mobile browser visitors should see the public Coop website first. Do not default normal mobile browser root visits into Mate, Hatch, or Roost.

## Colors

- Use the root warm earth palette with generous Cream and Surface areas so the website feels approachable rather than dense.
- Brown anchors credibility, governance, and the main narrative.
- Green signals community growth, shared knowledge, setup progress, and healthy local-first behavior.
- Orange is a sparse spark for calls to action, review moments, and "start a coop" emphasis.
- Avoid generic SaaS gradients, hard black dashboards, and cold blue trust styling.

## Typography

- Use large friendly display headlines for the homepage, setup invitations, and community storytelling.
- Body copy should feel plainspoken and concrete: what Coop does, who it helps, what stays private, and how a group starts.
- Use labels for short proof points, surface names, and action paths, not for decorative noise.
- Technical terms such as local-first, passkey, sync, Filecoin, or Safe should be explained in regular language before becoming jargon.

## Layout

- Public website pages should support desktop, tablet, and mobile browser without switching into installed-app chrome.
- The homepage should open with a confident, playful hero that explains Coop in one pass: capture scattered knowledge, review together, and act as a coop.
- Use section rhythm rather than dense app panels: hero, how it works, community use cases, trust/local-first proof, setup path, and closing call to action.
- Keep the current `/landing` route as the public website entry, and keep `/board/:coopId` aligned with public/shared coop context rather than receiver PWA chrome.
- Mobile browser layouts should remain website-first: stack sections, keep calls to action visible, and offer install/setup paths without hijacking the visit.

## Elevation & Depth

- Website depth can be more atmospheric than the PWA: warm radial glows, subtle grids, illustrative coop/nest scenes, and larger negative space.
- Use cards to explain steps and benefits, not to recreate an app dashboard.
- Sticky navigation may use warm blur or a translucent paper surface when needed, but it should not feel like a dense control bar.

## Shapes

- Hero and section cards use the large root radii and warm paper surfaces.
- CTA buttons use the root button radius; reserve full pills for small chips, route labels, and badges.
- Illustrations and brand moments can use egg, nest, and coop silhouettes, but functional website layout should stay readable and stable.

## Components

- **Hero:** State the promise clearly and make "set up a coop" or "install/open receiver" paths obvious without overloading the first screen.
- **How it works:** Show Capture, Refine, Review, Share as a simple loop with browser/PWA/extension roles named plainly.
- **Community setup:** Explain who starts a coop, how members join, and what is reviewed before anything becomes shared.
- **Trust section:** Make local-first, passkey-first, and explicit publish consent visible without turning the page into an architecture diagram.
- **Calls to action:** Use warm, specific CTAs such as "Set up a coop", "Install Coop Receiver", or "Read the docs" instead of generic "Get started" everywhere.
- **Proof and examples:** Prefer grounded coop/community examples over abstract productivity claims.

## Do's and Don'ts

- Do make the website credible enough for organizers and playful enough to feel community-owned.
- Do design mobile browser as a public website, not as an accidental PWA shell.
- Do keep setup paths honest about what exists today and what requires extension, PWA, or docs support.
- Do make privacy, review, and explicit publish consent part of the story.
- Don't use installed PWA Mate/Hatch/Roost as default browser navigation.
- Don't make the public site feel like an admin console or crypto dashboard.
- Don't overpromise autonomous agents acting without member review.
