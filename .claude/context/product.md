# Product Context

This document captures the product vision, user personas, brand direction, and success criteria for Coop v1.

## Vision

Coop is a browser-first, local-first knowledge commons for communities that already generate valuable context but struggle to turn it into shared memory and coordinated action.

**One-line framing**: Coop turns loose tabs into shared intelligence and fundable next steps.

**Supporting pitch**: Coop helps you get your chickens in order without defaulting to the major cloud AI platforms.

### Core Problem

The problem is not lack of information. It is fragmentation:
- Research disappears in private tabs
- Notes scatter across tools and people
- Communities lose continuity between calls
- Evidence lands too late to support funding or action

### V1 Loop

1. A community runs a setup ritual (four-lens structured conversation)
2. A trusted member creates a coop (with real Safe address)
3. Members join via invite codes (passkey-first, no wallet needed)
4. The extension rounds up relevant tabs locally
5. Members review drafts in the Roost and explicitly push them into shared coop memory
6. The coop leaves with live shared context, archive receipts, and clearer next actions

## User Personas

### Creator / Operator

The person who runs the setup ritual and creates the coop. They:
- Have a sense of the community's goals and pain points
- Run the four-lens ritual conversation before anyone installs the extension
- Create the coop, which generates a Safe address
- Generate invite codes for trusted and regular members
- Likely the facilitator for weekly review sessions

### Trusted Member

Invited with elevated trust. They:
- Join via a trusted invite code (48-hour expiry)
- Can generate their own invites
- Contribute a seed contribution on join
- Are expected to participate in weekly review and publishing
- May pair a mobile device for voice/photo capture

### Regular Member

Community participant. They:
- Join via a member invite code (7-day expiry)
- Browse normally while Coop notices relevant context locally
- Review drafts in the Roost and decide what to push
- Contribute to the shared feed
- Can archive artifacts to Storacha/Filecoin

### Mobile Contributor (Receiver)

Someone using the paired mobile web app:
- Scans QR code or taps deep link from the extension
- Captures audio notes, photos, or files
- Captures sync to the extension via WebSocket relay
- Captured content enters the private intake queue before review

## Brand Direction

### Chicken Metaphors

| Metaphor | Product Concept |
|----------|----------------|
| Loose Chickens | Open browser tabs that contain potentially useful context |
| Roost | The review queue where drafts wait for human judgment |
| Chickens Tab | Candidate list in popup and sidepanel (captured tabs awaiting review) |
| Coops Tab | Coop management and published artifact feed surface |
| Nest | Settings and admin tab in sidepanel (agent, receiver, invites, archive, settings) |
| Coop Feed | The shared feed of published artifacts across members |
| Launching the Coop | Creating a new coop (with Safe deployment) |
| Rooster Call | Success sound on coop creation |

The metaphor must clarify the value, not obscure it. Use chicken language in UI labels and copy, but keep core actions (publish, archive, review) clear.

### Visual Identity

Working brand: `Coop Town`

**Color palette** (from logo variants):
- `--coop-cream: #fcf5ef` — Default background and card base
- `--coop-brown: #4f2e1f` — Primary text, logo wordmark, dense UI
- `--coop-brown-soft: #6b4a36` — Secondary text, decorative linework
- `--coop-ink: #27140e` — Deepest brown, used for high-contrast text
- `--coop-error: #a63b20` — Error states, destructive actions
- `--coop-green: #5a7d10` — Knowledge/growth, active states, tag accents
- `--coop-orange: #fd8a01` — CTA accents, publish/archive emphasis, success moments
- `--coop-mist: #d8d4d0` — Neutral backdrop, soft dividers

**Visual principles**:
1. **Warm, not corporate** — Cream surfaces, earthy browns, soft green halos, orange highlights. No cold grayscale or flat SaaS blue.
2. **Observant, not surveillance-like** — "I noticed these tabs" language. Relevance suggestions shown gently. Never aggressive.
3. **Structured, not overdesigned** — Playful in iconography and success states. Restrained in core review and publish flows.

**Extension UI**: Dense but warm. Cream/mist base, brown text, green for active routing, orange for publish/archive.

**Landing page**: More atmospheric. Nest cards, lens cards, timeline steps. Hero with glow mark.

### Sound & Motion

- **Coop created**: Rooster call (celebratory)
- **Artifact published**: Soft cluck (success)
- **Passive capture**: No sound (silent)
- Sound is OFF by default. Users enable it in settings.
- Sounds are `.wav` files loaded from `packages/extension/public/audio/` (e.g., `coop-rooster-call.wav`, `coop-soft-cluck.wav`, `coop-squeaky-test.wav`). Played via `HTMLAudioElement` in extension views.

### Asset Files

```
docs/assets/branding/
  coop-mark-flat.png     — Extension icon, favicon, compact UI
  coop-wordmark-flat.png — Landing nav, hero, docs
  coop-mark-glow.png     — Splash moments, onboarding, success states
  coop-wordmark-glow.png — Hero only, sparingly
```

## Demo Success Criteria

The hackathon demo (PL Genesis) must prove:

### Must Show

1. Landing page narrative and ritual guide
2. Coop creation (with Safe address)
3. Trusted and regular member invite flows
4. Passive tab capture creating review drafts
5. Review and explicit push into selected coops
6. Live sync of published artifacts between two members
7. Simple weekly review surface grouped by category and member
8. A real coop Safe address
9. Playful but controlled sound and feedback moments

### Product Success If

- The product story is clear within one landing-page scroll
- The first-run flow is understandable without a live walkthrough
- Privacy boundaries are obvious (local vs shared)
- The extension does meaningful local work before anything is shared
- The shared coop feed feels live and collaborative
- The architecture can absorb future mobile capture, archive publishing, and garden actions without a rewrite

## Scope Boundaries

### V1 Includes

- Extension as primary product surface (popup is a full multi-screen app with Home/Chickens/Feed nav; sidepanel is the full workspace with Roost/Chickens/Coops/Nest tabs)
- Landing page (responsive, mobile-friendly)
- Passkey-first identity (no wallet extension required)
- Real Safe creation via Pimlico/ERC-4337
- Live Yjs sync via WebRTC + IndexedDB
- Manual and scheduled tab capture
- Browser-local relevance scoring (keyword classifier, no cloud AI)
- Review, publish, archive flow
- Storacha/Filecoin archival with receipts
- React Flow board visualization (read-only)
- Receiver mobile pairing and capture sync (audio, photo, file)

### V1 Explicitly Excludes

- Mobile-native apps
- Transcript capture on mobile
- Local file/folder/PDF library ingest
- Self-hosted signaling infrastructure
- Full React Flow editing (read-only snapshots only)
- Automatic archival of raw browsing exhaust
- Encrypted archive workflows
- Full Green Goods garden binding
- Built-in cloud LLM integrations
- Autonomous agent execution
- Session-key transactions
- End-user skill management UI

### System Principles

1. **Thin runtimes, strong shared package** — Extension and app are thin. All logic in `@coop/shared`.
2. **Explicit push privacy** — Nothing enters shared state until the member explicitly pushes. Passive observation stays local.
3. **Extension = Node** — The extension is the primary runtime and local home for capture, sync, and review.
4. **Passkey-first** — Identity is WebAuthn passkeys, not wallet extensions. Deterministic addresses from passkey credentials.
5. **Browser-local inference** — The core AI loop uses keyword classification, not cloud APIs. External LLMs are used by exporting data, not embedding inference.

## Key Files

- `docs/reference/coop-os-architecture-vnext.md` — Canonical v1 build plan (sections 1-4 cover product)
- `docs/reference/coop-design-direction.md` — Visual direction, palette, asset usage, motion/sound
- `docs/reference/coop-audio-and-asset-ops.md` — Audio sourcing and asset operations
- `docs/reference/scoped-roadmap-2026-03-11.md` — Current scoped roadmap
- `packages/app/src/views/Landing/index.tsx` — Landing page implementation
