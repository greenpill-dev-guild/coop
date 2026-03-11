# Coop Design Direction

This document captures the initial visual direction for Coop v1 based on the current logo explorations added to the repo.

It is not a final brand system. It is a practical guide for building the first landing page and extension UI in a way that already feels like Coop.

## 1. Brand Read

The current mark communicates the right mix of qualities for Coop:

- playful
- memorable
- slightly mischievous
- organic instead of sterile
- simple enough to work as an extension icon

The eyes make the product feel observant without becoming creepy.

That is useful because Coop is fundamentally doing three things:

- noticing what is already open in the browser
- helping sort what matters
- turning loose fragments into a more coherent shared memory

The logo gives us a visual language for that:

- the eyes suggest awareness
- the green crest suggests life, growth, and knowledge gardens
- the orange beak gives a bright action accent
- the brown wordmark grounds the product and keeps it from feeling too toy-like

## 2. Asset Set

Current source assets are stored in:

`docs/assets/branding/`

Audio source files and sourcing rules should be tracked separately in:

`docs/assets/audio/`

Included variants:

- `coop-mark-flat.png`
- `coop-wordmark-flat.png`
- `coop-mark-glow.png`
- `coop-wordmark-glow.png`

Recommended usage:

- `coop-mark-flat.png`
  Use for extension icon studies, favicon derivations, compact app headers, and UI badges.
- `coop-wordmark-flat.png`
  Use for the landing page nav, hero lockup, docs masthead, and screenshots.
- `coop-mark-glow.png`
  Use for splash moments, onboarding empty states, success states, and hero background compositions.
- `coop-wordmark-glow.png`
  Use sparingly for hero or launch moments, not for dense UI.

## 3. Working Palette

These colors were pulled from the flat logo variants and are close enough to use as v1 design tokens.

```css
:root {
  --coop-cream: #fcf5ef;
  --coop-brown: #4f2e1f;
  --coop-brown-soft: #55392a;
  --coop-green: #5a7d10;
  --coop-orange: #fd8a01;
  --coop-mist: #d8d4d0;
}
```

How to use them:

- `--coop-cream`
  Default landing background and card base.
- `--coop-brown`
  Primary text, logo wordmark, borders, dense UI copy.
- `--coop-brown-soft`
  Secondary text, decorative linework, quiet card outlines.
- `--coop-green`
  Knowledge/growth highlights, active states, tag accents, ritual callouts.
- `--coop-orange`
  CTA accents, beak-like action moments, archive/publish emphasis, audio/success moments.
- `--coop-mist`
  Neutral backdrop for glow treatments, sidepanel dividers, soft inactive UI.

## 4. Visual Principles

### 4.1 Warm, Not Corporate

Coop should feel warm and inhabited.

Avoid:

- cold grayscale dashboards
- flat SaaS blue accents
- sterile glassmorphism

Prefer:

- warm cream surfaces
- earthy browns
- soft green halos
- orange action highlights

### 4.2 Observant, Not Surveillance-Like

The logo eyes work because they feel curious and friendly.

In UI, that means:

- use “I noticed these tabs” language
- show relevance suggestions gently
- never make passive observation feel aggressive

### 4.3 Structured, Not Overdesigned

The product still needs to feel serious enough for governance, capital formation, and shared review.

So the UI should balance:

- playful brand moments
- restrained information design

The fun should live in:

- iconography
- success states
- copy tone
- hero illustrations

It should not make the core review and publish flows hard to scan.

## 5. Landing Page Direction

### 5.1 Hero

The landing page hero should use:

- `coop-wordmark-flat.png` or `coop-wordmark-glow.png`
- a warm cream or mist background
- soft radial green/orange glows behind the mark
- one short, direct headline

Recommended visual posture:

- centered or slightly off-center brand lockup
- layered rounded shapes behind it
- subtle “coop” framing or fence-grid geometry in the background

### 5.2 Section Visual Motifs

Recommended motifs:

- rounded “nest” cards for artifacts and review blocks
- fence or coop slat dividers for section framing
- little track marks or peck-dot patterns as separators
- clustered cards to imply a flock rather than a rigid dashboard

### 5.3 Setup Ritual Section

This is the most important visual block after the hero.

Use:

- four large lens cards
- simple icon treatment per lens
- a grouped call/notes/insight flow
- subtle green highlights for synthesis and connection

The section should feel like a guided community ritual, not a generic checklist.

## 6. Extension UI Direction

### 6.1 Sidepanel

The sidepanel should feel denser and more functional than the landing page, but still recognizable as Coop.

Recommended UI language:

- cream or mist base background
- brown text and outlines
- green highlighting for active routing or accepted knowledge
- orange for publish/archive/attention moments

### 6.2 Primary UI Shapes

Use:

- large rounded cards for `Loose Chickens` and `Roost`
- pill tags with green/brown contrast
- soft shadow or glow only on high-signal states
- simple borders rather than heavy panels

### 6.3 Icon State Language

The extension state treatments can borrow from the face:

- `Idle`
  calm neutral mark
- `Watching`
  subtle green halo or pulse
- `Review Needed`
  orange accent count or badge
- `Error/Offline`
  reduced saturation with a clear text state

Do not rely on the pupils or expression changing in a way that becomes too cute or ambiguous.

## 7. Motion And Sound

The glow variants suggest that Coop can support a little ceremony.

Recommended motion:

- launch animation with glow bloom on coop creation
- slight staggered reveal on review cards
- subtle pulse when new review items appear

Recommended sound posture:

- rooster call for successful coop creation
- soft cluck for successful publish
- no sound for passive background detection

Operational guidance for sourcing, licensing, naming, and shipping those files lives in:

`docs/coop-audio-and-asset-ops.md`

The motion and sound should feel like payoff, not interruption.

## 8. Typography Guidance

Typography should stay provisional until a designer refines it.

For v1:

- use a friendly, rounded or soft sans for headlines
- use a clean UI sans for body copy and extension density
- avoid overly futuristic or thin fonts

The logo already carries enough personality. The type does not need to overperform.

## 9. Practical Build Guidance

For the first build:

- use the flat assets for most UI
- reserve glow assets for hero, onboarding, and success states
- build the palette into CSS variables from the start
- keep iconography simple and rounded
- let the landing page be more atmospheric than the extension
- let the extension be more functional than decorative

## 10. Recommended Next Steps

1. Derive a favicon and extension icon set from `coop-mark-flat.png`.
2. Use `coop-wordmark-flat.png` in the landing page masthead and hero.
3. Create a small CSS token file with the working palette above.
4. Use the glow variants only in hero and success-state concepts.
5. Source or synthesize the v1 audio set using `docs/coop-audio-and-asset-ops.md`.
6. If a designer joins, hand them this doc plus the branding and audio asset folders as the starting brand package.
