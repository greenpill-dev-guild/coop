---
slug: /reference/coop-illustration-brief
title: "Illustration Brief"
sidebar_label: "Illustration Brief"
sidebar_position: 4
---

# Coop Illustration Brief

A design brief for creating the full illustration system for Coop — characters, scenes, icons, and an asset library that lets us quickly compose new visuals.

> **Audience:** This document is for our illustrator/designer. It assumes no familiarity with the codebase.

---

## 1. What Is Coop?

Coop is a browser extension + companion mobile app that helps groups capture scattered knowledge (browser tabs, voice memos, photos, links), refine it locally, and share what matters to a cooperative group ("coop"). Think of it as a shared knowledge commons for small teams and communities.

The product is built on an extended **chicken/farm metaphor**:

| Concept | Metaphor | Meaning |
|---|---|---|
| Browser tabs | **Loose Chickens** | Knowledge fragments scattered across your browser |
| Captured/drafted items | **Eggs** | Raw captures waiting to be reviewed |
| Review queue | **The Roost** | Where drafts land for human triage |
| Shared feed | **Coop Feed** | Published artifacts the whole group can see |
| Creating a group | **Launching the Coop** | Establishing a new cooperative |
| Success sound | **Rooster Call** | Audio celebration when a coop is created |
| Voice capture | **Chick** | A freshly hatched voice note |
| Photo capture | **Feather** | A visual fragment |
| File capture | **Twig** | Building material for the nest |
| Link capture | **Trail** | A path to follow |
| Device pairing | **Mating** | Connecting phone to browser |
| Inbox | **Nest** | Where captures settle before sync |

---

## 2. Existing Brand Assets

### 2.1 The Logo / Mark

The Coop mark is a **stylized chicken face**:
- Two large **brown** circular eyes with white crescent highlights
- A **green** heart-shaped crest on top
- An **orange** diamond-shaped beak
- Set on a **cream** cloud silhouette

The mark has **four state variants** (only the crest color changes):

| State | Crest Color | Meaning |
|---|---|---|
| Idle | Green `#5a7d10` | Normal / default |
| Watching | Blue `#00b4d8` | Actively scanning tabs |
| Review Needed | Orange `#fd8a01` | Items in the Roost |
| Error / Offline | Red `#a63b20` | Something's wrong |

**Files to reference:**
- `docs/assets/branding/coop-mark-flat.png` — The canonical mark
- `docs/assets/branding/coop-mark-glow.png` — Mark with warm ambient glow (hero/celebration use)
- `docs/assets/branding/coop-wordmark-flat.png` — "COOP" wordmark (the OO are the eyes)
- `docs/assets/branding/coop-mark-watching.png` — Blue crest variant
- `docs/assets/branding/coop-mark-review-needed.png` — Orange crest variant
- `docs/assets/branding/coop-mark-error-offline.png` — Red crest variant
- `docs/assets/branding/coop-symbol-idle.svg` — SVG source of the mark

### 2.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| Cream | `#fcf5ef` | Backgrounds, card surfaces |
| Brown | `#4f2e1f` | Primary text, outlines, dense UI |
| Brown Soft | `#6b4a36` | Secondary text, decorative line |
| Green | `#5a7d10` | Growth, knowledge, active states |
| Orange | `#fd8a01` | CTAs, action moments, attention |
| Mist | `#d8d4d0` | Neutral backdrops, dividers |
| Ink | `#27140e` | Darkest text accent |
| Error | `#a63b20` | Error states |

**Dark mode** inverts lightness but keeps hues recognizable — see `packages/shared/src/styles/tokens.css`.

### 2.3 Audio Assets (for context)

- `coop-rooster-call.wav` — Plays on coop creation (celebration)
- `coop-soft-cluck.wav` — Plays on publish (quiet confirmation)
- Sourced from Mixkit (free, no attribution)

### 2.4 What Exists Visually Today

**Everything beyond the logo is CSS-rendered geometry.** There are no hand-drawn illustrations. The current visuals are:
- A **nest** made from repeating linear-gradient (woven straw texture)
- **Eggs** as 24×30px CSS ovals with cream gradient fill
- **Sprouts** as small CSS green shoots
- A **ticket** card shape and **dashed trail** in the join flow
- An **egg button** for audio capture on the PWA
- Skeleton loading placeholders

This is what the brief is replacing with real illustration work.

### 2.5 Key Reference Files

| File | What's In It |
|---|---|
| `docs/reference/coop-design-direction.md` | Brand read, visual principles, palette, motion guidance |
| `docs/reference/extension-ui-redesign-plan.md` | Latest popup/sidepanel UI structure |
| `packages/shared/src/styles/tokens.css` | All design tokens (colors, spacing, radii, shadows) |
| `packages/extension/src/views/Popup/popup.css` | Popup theme variables, current CSS illustrations |
| `packages/extension/src/views/Popup/PopupOnboardingHero.tsx` | Current onboarding hero component |

---

## 3. Style Direction

### 3.1 The Feel

**Warm, organic, observant — not corporate or sterile.**

The illustrations should feel like they belong in a world that is:
- Lived-in, not polished to perfection
- Playful but grounded — not a toy, not a dashboard
- Curious and friendly — never aggressive or surveillance-like
- Hand-drawn or hand-crafted in spirit, even if digitally produced

**Where playfulness lives:**
- Illustrations, iconography, success states, empty states, hero moments
- Copy tone and character expression

**Where it does NOT live:**
- Core review/publish flows (must stay scannable and functional)
- Dense data UI, form fields, navigation chrome

### 3.2 Visual Style Reference

Think of the intersection of these influences:

**Primary Inspiration:**

- **Charley Harper** — Geometric nature illustrations with bold flat shapes, thick outlines, and playful compositions. His birds are the closest reference: round, characterful, reduced to essential shapes. [Search: "Charley Harper bird prints"]
- **Kurzgesagt** — Friendly rounded characters, warm color palettes, clear silhouettes that read at small sizes. The way they make complex topics approachable through character and warmth. [YouTube: Kurzgesagt]
- **Untitled Goose Game** — A single bird character driving an entire product's personality. The goose is mischievous but not malicious. Our chickens are curious but not creepy. Same energy, different species. [Search: "Untitled Goose Game art style"]

**Tonal Inspiration (attitude, not style):**

- **Chicken Run (Aardman)** — The plucky, determined, community-organizing chickens. Ginger rallying the flock to escape together = users rallying knowledge into a coop. The cooperative spirit, the "we're in this together" energy. Not the clay aesthetic, but the soul. [Film: Chicken Run, 2000]
- **Family Guy Chicken Fight** — Pure chaos energy of scattered information. The Peter vs. Giant Chicken fights are what your browser tabs look like before Coop organizes them. This is the "before" state — the "loose chickens" running wild. Reference for understanding the humor of the metaphor, not for visual style. [Search: "Family Guy chicken fight"]
- **Stardew Valley** — The cozy farm management feel. Warm colors, pixel-art charm translated to our vector style. The sense that tending to your coop is satisfying, not stressful. [Search: "Stardew Valley farm screenshots"]
- **Animal Crossing** — Rounded, approachable character design. The way villagers have personality through simple expressions. Our chickens should have that same "I could stare at this face and project emotions onto it" quality. [Search: "Animal Crossing villager design"]

**Visual Technique:**

- **Flat illustration with thick brown outlines** (2–3px at standard size)
- **No gradients** in fills except subtle shading on eggs
- **Transparent backgrounds** for all assets (composited onto CSS gradients)
- **Geometric simplification** — reduce forms to circles, ovals, rounded rectangles
- **Limited palette** — stick to the 8 brand colors, no new hues
- **Clear silhouettes** — every illustration should read as a silhouette at 50% size

### 3.3 What to Avoid

- Cold/corporate SaaS blue tones
- Flat sterile glassmorphism
- Hyper-detailed realistic chickens (we're not a farming app)
- Overly cute/kawaii/chibi — it should charm adults, not children
- Surveillance or "watching you" energy — the chickens are curious, not tracking
- Thin-line minimalist icon style (too generic, no personality)
- 3D renders or isometric style
- Stock illustration energy

---

## 4. Illustration Prompts by Screen

### Screen Map

The product has three surfaces that need illustrations:

```
EXTENSION POPUP (360×520px fixed)
├── Welcome / No Coop Screen ← hero illustration
├── Create Coop Screen ← hero illustration
├── Join Coop Screen ← hero illustration
├── Home Screen ← capture type icons
├── Draft List (empty) ← empty state
├── Draft Detail (success) ← success moment
├── Feed (empty) ← empty state
├── Profile Panel (no coops) ← empty state
├── Error / Blocking Notice ← error illustration
└── Loading ← loading animation

COMPANION PWA (mobile, responsive)
├── Capture View ← egg button / recording state
├── Inbox / Nest View (empty) ← empty state
├── Inbox items ← capture type badges
└── Pair View ← device connection

LANDING PAGE (desktop, full-width)
├── Hero section ← large scene illustration
├── Journey section ← animated chicken characters (8)
├── Ritual/Lens cards (4) ← themed card illustrations
└── How It Works cards ← small symbolic icons
```

---

### 4.1 Extension Popup Illustrations

#### P1 — Welcome Hero ("Ready to round up your loose chickens?")
**Where:** First screen a new user sees after installing the extension
**Dimensions:** 320×140px (fits within popup hero area)
**Emotional tone:** Warm, inviting, gently humorous

> **Scene:** A cozy wooden chicken coop (open-fronted, like a small barn or hutch) sits in the center-right with its door wide open. Three or four "loose chickens" — small, round birds matching the Coop mark style (big brown eyes, green crests, orange beaks) — are scattered across the foreground, each doing their own thing: one pecking at the ground, one looking off to the side, one mid-waddle. They represent unfocused browser tabs going about their business unorganized. One chicken near the coop door looks back at the others as if beckoning "come on in." The coop has a warm glow from inside. Cream background, brown outlines.
>
> **Key details:** The chickens should feel independent but not lost — they just need a home. The coop should feel welcoming, not confining.

#### P2 — Create Coop Hero ("Launch your coop")
**Where:** Create coop form screen
**Dimensions:** 320×140px
**Emotional tone:** Hopeful, new beginning, growth

> **Scene:** A single egg sitting in a small nest of woven straw, with two green sprouts growing from the straw on either side. The egg has a warm ambient glow suggesting potential energy within. Above the nest, a small pennant flag is being raised (the coop being "launched"). One chicken stands beside the nest looking determined and proud — this is the founder. A small "+" floats near the scene. Subtle radial green glow in the background.
>
> **Key details:** Keep it simple — dense form fields sit directly below this hero. The egg is the center of attention, the chicken is the supporting character.

#### P3 — Join Coop Hero ("Join with an invite code")
**Where:** Join coop form screen
**Dimensions:** 320×140px
**Emotional tone:** Social, welcoming, journey/arrival

> **Scene:** Two chickens walking toward each other from opposite sides along a dotted path/trail. The chicken on the right holds a small ticket or card in its beak (the invite code). Where they're about to meet in the center, a small nest is visible on the ground — "you're welcome here." Warm orange glow at the meeting point.
>
> **Key details:** The trailing dotted line is important — it echoes the current CSS "trail" element. The ticket/card should be clearly visible as a small rectangular object.

#### P4 — Empty Roost ("No chickens here yet")
**Where:** Draft list when empty
**Dimensions:** 280×100px (compact, inline)
**Emotional tone:** Patient, encouraging, anticipatory

> **Scene:** An empty wooden perching bar (the roost) — a horizontal beam on two short posts. No chickens on it. A few small feathers drift in the air. Below the roost, one tiny egg sits on the ground, undiscovered. A subtle visual cue (small arrow, footprints leading offscreen) suggests "go find some tabs to round up."
>
> **Key details:** The roost should feel ready and waiting, not abandoned. It's a "before" state, not a sad state.

#### P5 — Empty Feed ("Nothing shared yet")
**Where:** Feed tab when empty
**Dimensions:** 280×100px (compact, inline)
**Emotional tone:** Expectant, communal

> **Scene:** A small wooden notice board or fence post with a blank posting area. One chicken stands looking up at the empty board, head tilted with curiosity. A small green sprout grows at the base of the post. Perhaps a single pushpin on the empty board.
>
> **Key details:** The notice board should feel communal — this is a shared space. The lone chicken is the first contributor.

#### P6 — Empty Profile ("No coops yet")
**Where:** Profile panel, no coops state
**Dimensions:** 240×80px (compact)
**Emotional tone:** Decision point, friendly

> **Scene:** A single chicken sitting at a fork in a path, looking at a signpost with two arrows — one pointing toward "Create" and one toward "Join." The chicken appears contemplative but not stuck. Simple ground/grass beneath.
>
> **Key details:** Two clear options, neither weighted more than the other.

#### P7 — Success: Coop Created
**Where:** Shown after successfully creating a new coop (the "Rooster Call" audio plays simultaneously)
**Dimensions:** 200×160px (overlay or inline celebration)
**Emotional tone:** Triumphant, celebratory, payoff

> **Scene:** A proud rooster stands atop a freshly-built coop, crowing toward the sky with its beak wide open. Sound lines emanate from the beak. Small celebration elements float around: a few confetti-like feathers in brand colors (green, orange), tiny sparkles. The coop below is complete with walls and a roof. Two or three smaller chickens peek out from inside or gather at the base looking up admiringly. Warm sunrise/golden glow behind the rooster.
>
> **Key details:** This is THE payoff moment in the product. It should feel earned and exciting. The rooster's crow is the visual version of the audio "Rooster Call."

#### P8 — Success: Published to Feed
**Where:** After publishing a draft to shared feed (soft cluck audio plays)
**Dimensions:** 160×120px (inline)
**Emotional tone:** Quiet satisfaction, contribution

> **Scene:** A chicken placing a small card or note onto a wooden notice board that already has one or two other cards pinned to it. A small green checkmark glow appears where the new card is placed. Other chickens nearby (1–2) look over with interest. Simpler and quieter than the coop-creation celebration.
>
> **Key details:** This is a recurring moment, not a one-time event. It should feel good but not over-the-top. "Nice, that's shared now."

#### P9 — Error State
**Where:** Generic error or offline blocking notice
**Dimensions:** 200×120px
**Emotional tone:** Sympathetic, not alarming

> **Scene:** A chicken sitting in gentle rain, holding a large leaf over its head as an umbrella. It looks slightly confused (head tilt, one eye slightly bigger) but not distressed. On the ground nearby, a small disconnected cable or broken chain link. Colors are slightly desaturated — muted versions of the brand palette. The rain is gentle, not a storm.
>
> **Key details:** Errors should feel recoverable, not catastrophic. The chicken is inconvenienced, not in danger.

#### P10 — Loading State
**Where:** "Loading popup..." and other loading moments
**Dimensions:** 80×80px (could be animated as a 3–4 frame sprite)
**Emotional tone:** Anticipatory, gentle

> **Scene:** A single egg rocking gently side to side. A tiny crack appears on one side, and the tip of a small orange beak peeks through. The egg sits in a tiny nest.
>
> **Key details:** If animated, the sequence is: rest → rock left → rock right → crack appears → beak peeks. Loop-friendly. If static, show the moment of the first crack with the beak visible.

#### P11 — Home Screen Capture Icons
**Where:** Capture handoff buttons on the popup home screen
**Dimensions:** 32×32px each
**Emotional tone:** Clear, functional, a touch of character

> **Audio icon:** A small chick with beak open, emitting 2–3 curved sound-wave lines.
>
> **Photo icon:** A chick peeking through/around a square picture frame, one eye visible.
>
> **File icon:** A chick carrying a small twig or rolled paper in its beak, walking purposefully.
>
> **Link icon:** Two eggs or footprints connected by a small chain link.

---

### 4.2 Companion PWA Illustrations

#### P12 — Capture Egg Button
**Where:** Primary action on the mobile capture screen — a large tappable egg for audio recording
**Dimensions:** 120×120px, two states
**Emotional tone:** Tactile, inviting, responsive

> **Idle state:** A large, warm egg resting in a small nest. Serene, softly glowing cream-to-tan gradient. Feels tappable.
>
> **Recording state:** The egg is cracked open and warm orange/amber light pours out from within. Small sound-wave ripples emanate outward from the crack. The nest remains. The effect suggests "your voice is being captured inside this egg."
>
> **Key details:** This replaces a CSS-only egg button. It should feel organic and satisfying to tap. The transition between states should feel like something alive is happening.

#### P13 — Capture Type Badges (Chick Variants)
**Where:** Inline labels in the inbox — "Voice chick," "Photo chick," "File chick," "Link chick"
**Dimensions:** 24×24px each
**Emotional tone:** Distinctive, quick-read, playful

> **Voice chick:** A tiny round chick (almost spherical fluffball) with beak open. A musical note or sound wave next to it.
>
> **Photo chick:** A tiny chick peeking out from behind or sitting inside a square frame border.
>
> **File chick:** A tiny chick sitting on top of a small folded paper or document, nesting on it.
>
> **Link chick:** A tiny chick with a small chain link or two connected dots trailing behind it like a tail.
>
> **Key details:** These appear repeatedly in lists. They must be instantly distinguishable at 24px. Each should have a unique silhouette.

#### P14 — Empty Nest (Inbox Empty)
**Where:** "Your inbox is empty. Head to Capture to hatch the first note, photo, or link."
**Dimensions:** 200×100px
**Emotional tone:** Cozy emptiness, ready and waiting

> **Scene:** A well-made nest of woven straw and small twigs, viewed from slightly above. It's round, cozy, but vacant. A few small feathers lie around the outside. Tiny footprint tracks lead away from the nest toward the top of the composition, suggesting "go make something."

#### P15 — Pair View (Device Sync)
**Where:** Pairing the phone with the browser extension via QR or nest code
**Dimensions:** 200×140px
**Emotional tone:** Connection, trust, bridging

> **Scene:** A simplified phone (left) and laptop screen (right), each with a small chicken sitting on top. Between the devices, a warm dotted arc connects them. At the peak of the arc, a small nest with a single egg appears — the shared connection point. Green glow at the connection. The devices are drawn in the brand's brown outline style, not realistic.
>
> **Key details:** This should feel warm and trustworthy, not technical. "Your captures will flow safely between your devices."

---

### 4.3 Landing Page Illustrations

#### P16 — Hero Scene
**Where:** Right side of the landing page hero section (sits alongside headline + CTAs)
**Dimensions:** 500×400px
**Emotional tone:** Inspiring, demonstrates the product's value at a glance

> **Scene:** A panoramic view at golden hour. **Left third:** 3–4 chickens scattered across an open field, each pecking at or carrying different items (small cards labeled "tab," a rolled note, a photo, a link icon) — knowledge is everywhere but disorganized. **Center:** A warm, well-built chicken coop with the Coop mark subtly above the door, glowing warmly from inside. **Right third:** Inside and around the coop, everything is organized — cards are neatly arranged on shelves or pinned to a board, chickens perch contentedly in rows, green sprouts grow around the structure. The visual flow reads left-to-right: chaos → coop → order.
>
> **Key details:** This is the single most important illustration. It should communicate "Coop gathers your scattered knowledge into shared, organized memory" without any text. Warm golden light bathes the entire scene.

#### P17 — Journey Chickens (Scroll-Animated Characters)
**Where:** Journey section — 8 chicken characters fly/walk across the viewport as the user scrolls
**Dimensions:** Three sizes (adult 60×60, young 48×48, chick 36×36)
**Emotional tone:** Characterful, energetic, readable in motion

> **Adult chicken (60×60px):** Full-sized chicken matching the brand mark face — green crest, brown eyes, orange beak — with a visible body, small tucked wings, and two-toed feet. Standing/walking pose, slightly forward-leaning. Round body, geometric Charley Harper simplification.
>
> **Young chicken (48×48px):** Same features, slightly smaller crest, rounder/plumper body, shorter legs. More curious wide-eyed expression.
>
> **Chick (36×36px):** A tiny round ball of fluff with disproportionately large eyes (matching the mark), a tiny green tuft on top, and a small orange beak. Almost perfectly spherical. Adorable.
>
> **Key details:** Each of the 8 journey chickens represents a capture type (Tabs, Notes, Ideas, Signals, Links, Drafts, Threads, Clips). They need to work as silhouettes in motion. Assigned variants:
> - Tabs, Notes, Ideas, Signals → adult
> - Links, Threads → young
> - Drafts, Clips → chick

#### P18 — Ritual Lens Cards (4 Themed Illustrations)
**Where:** The setup ritual section — four large cards for Knowledge, Capital, Governance, Impact
**Dimensions:** 200×160px each
**Emotional tone:** Each has its own character, all clearly from the same world

> **Knowledge:** A chicken wearing tiny round spectacles, standing before a small bookshelf or stack of notes. A magnifying glass leans against the shelf. Small green sprouts grow between the books, suggesting living knowledge. Feel: curiosity, research, learning.
>
> **Capital:** A chicken standing beside a nest holding three golden-tinted eggs. One egg has a tiny green sprout growing from its top, suggesting investment that grows. A small coin or token sits nearby on the ground. Feel: stewardship, resources, growth.
>
> **Governance:** Three chickens sitting in a loose circle, facing each other on a shared perch or around a small round surface. One holds a small card or raises a wing (voting). Their expressions are engaged, deliberative. Feel: shared decision-making, collective voice.
>
> **Impact:** A single chicken standing on a gentle hill, looking out at a landscape where small trees and sprouts have grown. Behind the chicken, footprint trails lead back to a coop in the distance. Feel: looking back at progress, outcomes, proof that work mattered.

---

### 4.4 Shared / Cross-Surface

#### P19 — Navigation Icons (Sidepanel + Popup Footer)
**Where:** Tab bar navigation — Chickens, Feed, Contribute, Manage
**Dimensions:** 20×20px each
**Emotional tone:** Clear, functional, on-brand

> **Chickens tab:** Simplified chicken head — just the crest + eyes + beak from the mark, reduced to 20px. A tiny version of the logo face.
>
> **Feed tab:** A small rectangle (notice board) with 2–3 horizontal lines inside (content), tiny chicken silhouette watermark.
>
> **Contribute tab:** An egg with a small upward arrow above it — "send something out."
>
> **Manage tab:** A gear or wrench shape combined with a nest outline — settings/admin.

#### P20 — Archive / Persistence
**Where:** When content is archived to permanent storage (Filecoin)
**Dimensions:** 160×120px
**Emotional tone:** Permanence, trust, safekeeping

> **Scene:** A chicken carefully placing an egg into a stone cellar or vault. The vault has a small green checkmark carved or glowing on it. Below ground level, visible root systems or geological layers suggest deep, permanent storage. Above ground is warm and green; below is cool stone — the contrast reinforces "this is saved for good."

---

## 5. Asset Library Architecture

### 5.1 Character System (Modular Chicken Builder)

Design chickens as **modular assemblies** so new characters and scenes can be composed quickly from reusable parts. Each part should be a separate layer/artboard in the source file.

```
CHARACTER PARTS
│
├── Bodies
│   ├── adult-standing          (default pose, upright)
│   ├── adult-walking           (forward lean, feet mid-stride)
│   ├── adult-sitting           (settled on perch or nest)
│   ├── adult-pecking           (head down, beak near ground)
│   ├── young-standing          (smaller, rounder proportions)
│   ├── young-walking
│   ├── chick-standing          (round fluffball)
│   └── chick-hatching          (half in, half out of egg shell)
│
├── Heads / Expressions
│   ├── neutral                 (matches the logo — default)
│   ├── curious                 (head tilted 15°, one eye slightly larger)
│   ├── proud                   (head up, beak angled skyward)
│   ├── confused                (head tilted opposite way, pupils offset)
│   ├── happy                   (eyes slightly squinted, beak hint of smile)
│   ├── sleeping                (eyes closed as curved lines, small Z's)
│   ├── alert                   (eyes wide open, crest perked up)
│   ├── singing / calling       (beak wide open, sound lines)
│   └── determined              (slight forward lean, focused eyes)
│
├── Crests (color = state)
│   ├── green                   (idle / default)
│   ├── blue                    (watching / scanning)
│   ├── orange                  (review needed / attention)
│   └── red                     (error / offline)
│
├── Accessories (optional, character-specific)
│   ├── spectacles              (knowledge / research)
│   ├── hard-hat                (building / creating)
│   ├── scarf                   (cozy / community)
│   ├── tiny-backpack           (journey / migration)
│   ├── magnifying-glass        (held in wing)
│   ├── card-in-beak            (carrying a note/ticket)
│   ├── gavel                   (governance)
│   └── ticket-in-beak          (invite / join)
│
├── Props (scene elements)
│   ├── nest                    (woven straw — top-down + side views)
│   ├── egg-plain               (cream gradient, default)
│   ├── egg-glowing             (warm ambient light)
│   ├── egg-cracking            (crack + beak peeking)
│   ├── egg-golden              (for capital / special moments)
│   ├── coop-building           (small barn/hutch — small, medium, large)
│   ├── perch-bar / roost       (horizontal wooden beam on posts)
│   ├── notice-board            (for feed — wooden frame, pushpins)
│   ├── fence-section           (rustic wooden slats)
│   ├── sprouts                 (2-leaf seedling, 3-leaf, small tree)
│   ├── feathers                (1 floating, cluster of 2–3)
│   ├── footprints              (chicken foot tracks in a trail)
│   ├── sound-waves             (2–3 curved lines for audio)
│   ├── sparkles                (small celebration particles)
│   ├── confetti-feathers       (green + orange feathers falling)
│   ├── rain-drops              (gentle, not stormy)
│   ├── leaf-umbrella           (large leaf held overhead)
│   ├── vault / cellar          (stone archway for archive)
│   └── signpost                (wooden post with arrow signs)
│
└── Environments (backgrounds, usually partial)
    ├── grass-patch             (small foreground tuft)
    ├── golden-hour-glow        (warm radial light)
    ├── sunrise-rays            (for celebration moments)
    ├── gentle-rain             (for error states, desaturated)
    ├── underground-layers      (stone + roots, for archive)
    └── dotted-path / trail     (connecting elements)
```

### 5.2 Icon System

All icons on a **24px grid**, **2px stroke** in brown (`#4f2e1f`), with optional brand color fills.

```
ICONS (24×24px)
│
├── Capture Types
│   ├── icon-tab                (browser tab shape + tiny chicken eye)
│   ├── icon-audio              (chick + sound waves)
│   ├── icon-photo              (frame + eye peeking through)
│   ├── icon-file               (document + chick sitting on it)
│   ├── icon-link               (two connected egg-chain links)
│   ├── icon-note               (pencil + egg)
│   └── icon-thread             (connected speech bubbles)
│
├── Actions
│   ├── icon-roundup            (lasso or gathering arrows)
│   ├── icon-publish            (egg + upward arrow)
│   ├── icon-archive            (vault + checkmark)
│   ├── icon-share              (two eggs with connection line)
│   ├── icon-review             (magnifying glass over egg)
│   └── icon-create             (nest + sparkle/star)
│
├── States
│   ├── icon-success            (egg + green checkmark)
│   ├── icon-error              (cracked egg + red X)
│   ├── icon-offline            (egg + cloud with slash)
│   ├── icon-syncing            (egg + circular arrows)
│   └── icon-empty              (empty nest outline, dashed)
│
└── Navigation
    ├── icon-home               (coop building silhouette)
    ├── icon-chickens           (chicken head / mark mini)
    ├── icon-feed               (notice board)
    ├── icon-contribute         (egg + up arrow)
    └── icon-manage             (gear + nest)
```

### 5.3 Scene Templates

Reusable compositions for common patterns:

```
SCENE TEMPLATES
├── hero-onboarding            (320×140 — logo + nest + characters + props)
├── empty-state-compact        (280×100 — single prop + optional character)
├── success-celebration        (200×160 — character + coop + celebration FX)
├── success-quiet              (160×120 — character + action + checkmark)
├── error-sympathetic          (200×120 — character + weather + broken prop)
├── loading-egg                (80×80 — egg + crack animation frames)
├── device-bridge              (200×140 — two devices + connection arc)
└── hero-panoramic             (500×400 — full scene with multiple zones)
```

---

## 6. Delivery Specifications

### 6.1 Formats

| Asset Type | Source | Export |
|---|---|---|
| Characters & props | Figma / Illustrator (vector) | SVG + PNG @1x/@2x/@3x |
| Scene illustrations | Figma / Illustrator | SVG + PNG @1x/@2x |
| Icons | Figma (24px grid) | SVG (inline-ready) + PNG @1x/@2x |
| Animated sequences | After Effects / Lottie | Lottie JSON + CSS sprite fallback |
| Extension toolbar icons | PNG (must be PNG for Chrome MV3) | 16, 32, 48, 128px × 4 states |

### 6.2 Size Targets

| Context | Max Dimensions | Notes |
|---|---|---|
| Popup hero | 320×140px | Fixed 360px-wide popup |
| Popup empty state | 280×100px | Compact, inline |
| Popup celebration | 200×160px | Can overlay |
| PWA capture button | 120×120px | Tappable, two states |
| PWA badges | 24×24px | Inline in list items |
| Landing hero | 500×400px | Responsive, may scale down |
| Journey characters | 36/48/60px | Animated on scroll |
| Ritual cards | 200×160px | Inside card containers |
| Nav icons | 20×20px | Tab bar |
| Action icons | 24×24px | Buttons, inline |

### 6.3 Color Rules

| Element | Light Mode | Dark Mode |
|---|---|---|
| Outlines | `#4f2e1f` | `#c9a88a` |
| Body fill | `#fcf5ef` | `#3a2e26` |
| Crest (idle) | `#5a7d10` | `#83a236` |
| Beak | `#fd8a01` | `#cb7111` |
| Eyes | `#4f2e1f` body, `#fff` highlight | `#c9a88a` body, `#fff` highlight |
| All backgrounds | Transparent | Transparent |

Every illustration should be delivered in **both light and dark variants** (outline and fill color swap).

### 6.4 File Naming Convention

```
coop-{type}-{subject}-{variant}-{state}.{ext}

type:    char | scene | icon | prop | env
subject: adult | chick | welcome | empty-roost | capture-audio | etc.
variant: neutral | curious | proud | light | dark | etc.
state:   idle | watching | review | error (optional)

Examples:
coop-char-adult-neutral-idle.svg
coop-char-chick-singing.svg
coop-scene-welcome-hero-light.svg
coop-scene-empty-roost-dark.svg
coop-icon-capture-audio-24.svg
coop-icon-nav-chickens-20.svg
coop-prop-nest-side.svg
coop-prop-egg-glowing.svg
coop-env-golden-hour.svg
```

---

## 7. Priority & Sequencing

### Phase 1: Character Foundation + Onboarding (unlocks everything)
1. **Character sheet** — Adult, young, chick bodies × all expressions
2. **Welcome hero** (P1) — Highest-traffic screen
3. **Create hero** (P2) + **Join hero** (P3) — Complete the onboarding trio
4. **Coop Created celebration** (P7) — Key emotional payoff

### Phase 2: Empty States + Daily Use
5. **Empty roost** (P4), **empty feed** (P5), **empty nest** (P14), **empty profile** (P6)
6. **Capture type badges** (P13) — Voice/photo/file/link chicks (used in every list)
7. **Published to feed** success (P8)
8. **Capture egg button** (P12) — PWA primary action

### Phase 3: Landing Page + Polish
9. **Landing hero scene** (P16)
10. **Journey chickens** (P17) — 3 character variants for scroll animation
11. **Ritual lens cards** (P18) — Knowledge, Capital, Governance, Impact
12. **Error state** (P9) + **Loading state** (P10)

### Phase 4: Icon System + Refinement
13. **Navigation icons** (P19)
14. **Home screen capture icons** (P11)
15. **Archive illustration** (P20)
16. **Full icon set** (capture types, actions, states)
17. Dark mode variants of all scenes

---

## 8. Inspiration & Reference Links

### Primary Style References
- **Charley Harper prints** — Search "Charley Harper birds" or visit [charleyharper.com](https://www.charleyharper.com). Focus on: geometric simplification, flat color, bold shapes, personality through minimal features.
- **Kurzgesagt** — [youtube.com/@kurzgesagt](https://www.youtube.com/@kurzgesagt). Focus on: rounded friendly characters, warm saturated palettes, how they make complex ideas approachable. Their bird characters are especially relevant.
- **Untitled Goose Game** — Search "Untitled Goose Game art" or visit [goose.game](https://goose.game). Focus on: a single bird character driving an entire product's personality, mischievous-but-not-malicious energy, simple line work.

### Tonal / Narrative References
- **Chicken Run (Aardman, 2000)** — The cooperative spirit of chickens organizing to build something together. Ginger rallying the flock = users building a coop. Watch the trailer for the team energy.
- **Family Guy — Peter vs. Giant Chicken** — Search "Family Guy chicken fight compilation." The chaos of these fights is what your browser tabs look like before Coop intervenes. Pure "loose chickens" energy. Reference for humor/metaphor, not visual style.
- **Stardew Valley** — Search "Stardew Valley farm screenshots." The cozy farming-as-care feel. Tending your coop should feel like tending your farm — satisfying, not stressful.
- **Animal Crossing** — Search "Animal Crossing villager design." Rounded, expressive characters with personality conveyed through simple features. Our chickens need that "project your emotions onto this face" quality.
- **Lottie animations on LottieFiles** — Search "bird animation lottie" or "chicken lottie" for motion reference. The loading-egg animation (P10) would work well as a Lottie.

### Direct Visual References from the Codebase
- The logo mark itself is the north star — every chicken character should feel like a full-body version of that face
- The CSS nest/egg/sprout compositions in `popup.css` show the spatial relationships and sizing we're replacing
- The `coop-mark-glow.png` variant shows how warm ambient glow should feel for celebration/hero moments
- `docs/reference/coop-design-direction.md` has the full brand read and visual principles

### Color & Palette Tools
- Current palette as CSS variables: `packages/shared/src/styles/tokens.css`
- Suggested tool: Drop the hex values into [Coolors](https://coolors.co) to explore the palette interactively

---

## 9. Working Together

### What we need from you
- Source files in **Figma** (preferred) or Illustrator
- All character parts as **separate components/layers** (not flattened into scenes)
- Exported assets per the naming convention and format table above
- Both light and dark mode variants

### What we'll handle
- Integration into the codebase (CSS, React components, build pipeline)
- Animation implementation (CSS keyframes or Lottie player)
- Responsive sizing and dark-mode switching logic
- Extension icon generation from your mark variants

### Feedback loop
- We'll integrate Phase 1 first and ship to real users before proceeding
- Expect iteration on character proportions and expressions — getting the chicken personality right is the foundation everything else builds on
- Screenshots of illustrations in context (in the actual popup, on the actual landing page) will be shared back for refinement
