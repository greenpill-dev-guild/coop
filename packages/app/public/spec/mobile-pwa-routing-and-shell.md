# Coop Mobile PWA Routing And Shell

Date: March 17, 2026

This spec defines how `packages/app` should behave across desktop web, mobile web, and installed
PWA contexts.

It exists because the current app has grown beyond the original "landing page only" assumption.
Today, the codebase already ships a real receiver app shell at `/pair`, `/receiver`, and `/inbox`,
but the root path `/` still behaves like a marketing-only site on mobile. This spec closes that
gap.

This document is the source of truth for mobile PWA entry behavior, route ownership, and app-shell
requirements until the broader architecture docs are consolidated.

## 1. Problem

Current behavior:

- `https://coop.town/` renders the landing page on desktop and mobile.
- `https://coop.town/receiver` renders the receiver app shell.
- The manifest starts the installed app at `/receiver`, but first-time mobile visitors who open
  `/` do not enter the app experience.
- The landing page is extension-first and does not provide a clear mobile path into the receiver.
- The receiver shell still carries a few website-oriented behaviors that weaken the app feel.

Result:

- Mobile users can arrive at the product and never discover the actual app.
- Installed and non-installed mobile flows are inconsistent.
- The site architecture does not match the intended product story of desktop landing plus mobile
  receiver PWA.

## 2. Decision

Coop will use a platform-aware root bootstrap route.

- `/` becomes a decision route, not a permanent landing page.
- `/landing` becomes the explicit marketing route.
- `/pair`, `/receiver`, and `/inbox` remain the receiver app routes.
- `/board/:coopId` remains unchanged.

Desktop users who open `/` should land on the marketing site.

Mobile users who open `/` should be routed into the receiver app flow.

Installed PWA launches should use the same root bootstrap logic as mobile web, rather than relying
on a separate hardcoded start destination.

## 3. Goals

- Make `coop.town` open into the app experience on mobile.
- Preserve the landing page as the desktop-first marketing experience.
- Keep app routes feeling like an app, not like a marketing site hidden behind another path.
- Keep pairing, share-target, and board deep links working exactly when opened directly.
- Make root behavior deterministic and testable.

## 4. Non-Goals

- No redesign of the receiver information architecture.
- No change to board route semantics.
- No auth system change.
- No extension-side pairing redesign.
- No CSP policy change in this spec.

The current WebAssembly CSP error must be handled as a separate security-sensitive task. Routing
work must not silently broaden `script-src` without an explicit review.

## 5. Route Ownership

Routes:

- `/`
  Root bootstrap route. Makes a runtime decision and redirects.
- `/landing`
  Marketing and install education route for desktop web.
- `/pair`
  Receiver pairing route.
- `/receiver`
  Receiver capture route.
- `/inbox`
  Receiver inbox route.
- `/board/:coopId`
  Coop board route. No root-boot logic applies here.

Rules:

- Only `/` performs platform-aware redirection.
- Explicit routes must never be re-routed by device heuristics.
- A direct visit to `/pair`, `/receiver`, `/inbox`, or `/board/:coopId` must render that route.

## 6. Runtime Surface Detection

The app must add a small runtime surface helper.

It should expose only synchronous environment facts:

- `isMobile`
- `isStandalone`
- `platform`

It must not include persistent app state such as pairing presence.

Recommended detection:

- `isStandalone`
  `window.matchMedia("(display-mode: standalone)")` and iOS `navigator.standalone === true`
- `isMobile`
  user agent plus touch/mobile viewport heuristics, implemented conservatively
- `platform`
  `ios`, `android`, or `desktop/unknown`

This helper belongs in shared app/runtime utilities so it can be reused by both landing and receiver
surfaces.

## 7. Root Bootstrap Behavior

Root bootstrap behavior must use both runtime surface detection and local receiver state.

The bootstrap flow at `/` is:

1. Detect surface context.
2. If desktop web, redirect to `/landing`.
3. If mobile or standalone, check local receiver pairing state.
4. If there is an active pairing, redirect to `/receiver`.
5. If there is no active pairing, redirect to `/pair`.

This flow may show a very brief boot state while local state is checked.

### 7.1 State Inputs

The only async state required for the root decision is whether an active receiver pairing exists.

The implementation should reuse the existing receiver persistence model and `getActiveReceiverPairing`
rather than inventing a second local flag.

### 7.2 Boot State

The root route may render a minimal boot screen while checking local state.

Requirements:

- fast
- visually aligned with receiver branding
- no marketing copy
- no visible layout jump once the redirect resolves

## 8. Mobile Destination Rules

Root destination matrix:

- Desktop browser on `/` -> `/landing`
- Mobile browser on `/` with no active pairing -> `/pair`
- Mobile browser on `/` with active pairing -> `/receiver`
- Installed standalone PWA on `/` with no active pairing -> `/pair`
- Installed standalone PWA on `/` with active pairing -> `/receiver`

Rationale:

- first-run mobile users should enter the app, not the landing page
- unpaired devices should see the pairing flow first
- paired devices should go straight to capture

## 9. Landing Route Requirements

`/landing` remains the marketing route and desktop education surface.

Requirements:

- desktop-first narrative
- clear extension install guidance
- clear "open on your phone" guidance
- QR code to the root origin so phones enter the bootstrap flow
- optional "open app" CTA when the device is already mobile or installed

The landing page must stop being the implicit root experience for everyone.

## 10. Receiver Shell Requirements

The receiver routes must feel like a native app surface.

### 10.1 App Chrome

Requirements:

- fixed full-screen shell
- safe-area aware header and bottom app bar
- in-app navigation only
- no primary chrome action that dumps the user back to the marketing site

The receiver mark in the header must no longer navigate to `/`.

Preferred behavior:

- navigate to `/receiver`
- or act as a non-navigating brand mark

### 10.2 Route Titles And Metadata

Receiver routes must set app-like document titles:

- `/pair` -> `Coop Mate`
- `/receiver` -> `Coop Hatch`
- `/inbox` -> `Coop Roost`
- `/landing` -> `Coop | Turn knowledge into opportunity`

The app should also support route-level theme handling where needed so the receiver shell does not
inherit only marketing-oriented page semantics.

### 10.3 Install UX

Install affordances must be visible from inside the receiver shell on first-run mobile web.

Requirements:

- install CTA should not live only inside the settings sheet
- mobile web users should see a clear install nudge in the app flow
- installed users should not see repeated install prompts

The settings sheet may retain install controls, but it must not be the primary discoverability
path.

### 10.4 App-Like Navigation Feel

Requirements:

- route changes should preserve the app shell
- app routes should not reveal landing-page navigation
- scroll handling should remain shell-local
- direct route loads should feel like entering an app screen, not a subpage of a website

## 11. Manifest Behavior

The manifest start route should align with root bootstrap behavior.

Decision:

- once the root bootstrap route exists, `start_url` should move to `/`

Rationale:

- installed launches should reuse the same root decision logic as mobile web
- unpaired installs should go to `/pair`
- paired installs should go to `/receiver`
- the app should not need separate install-only routing rules

This change should ship only after the root bootstrap route is implemented.

## 12. Pairing And Share Handoff Rules

Pairing and share routes already exist and must remain first-class.

Requirements:

- `/pair` must continue to accept HTTPS payload handoffs
- `/receiver` must continue to accept share-target query params
- route sanitization after payload intake must remain in place
- root bootstrap must never intercept or rewrite these explicit routes

## 13. Protocol Handler Decision

The current custom protocol handler is not valid in production and should not be treated as the
primary mobile entry path.

Canonical pairing entry should be HTTPS-first:

- `/pair#payload=...`
- or `/pair?payload=...`

Requirements:

- the extension should generate shareable HTTPS pairing links as the default
- the mobile app should continue parsing existing payload forms where reasonable
- custom protocol behavior may remain as a best-effort enhancement only if it is standards-valid
  and verified

The routing implementation must not depend on the custom protocol handler working.

## 14. Testing Requirements

This work is incomplete without explicit tests.

### 14.1 Root Bootstrap Tests

Add tests for:

- desktop `/` -> landing
- mobile `/` with no pairing -> pair
- mobile `/` with pairing -> receiver
- standalone `/` with no pairing -> pair
- standalone `/` with pairing -> receiver

### 14.2 Explicit Route Preservation Tests

Add tests for:

- `/pair` remains `/pair`
- `/receiver` remains `/receiver`
- `/inbox` remains `/inbox`
- `/board/:coopId` remains board

### 14.3 App Shell UX Tests

Add tests for:

- receiver logo does not navigate to landing
- install CTA is visible in mobile web receiver flow
- route-level titles update correctly

### 14.4 Production Validation

Manual checks:

- iPhone Safari mobile web
- iPhone installed home-screen app
- Android Chrome mobile web
- Android installed PWA
- desktop web landing on `/`

## 15. Implementation Outline

Recommended order:

1. Add runtime surface helper.
2. Add root bootstrap component and `/landing` route split.
3. Add async pairing-state boot decision.
4. Update manifest `start_url` to `/` after bootstrap exists.
5. Update receiver shell chrome and install affordance.
6. Switch extension pairing links to HTTPS-first canonical deep links.
7. Add full test coverage.

## 16. Acceptance Criteria

This spec is complete when all of the following are true:

- opening `https://coop.town/` on desktop shows the landing page
- opening `https://coop.town/` on mobile enters the receiver flow
- first-run mobile users land on pairing, not marketing
- returning paired mobile users land on capture
- installed launches follow the same logic
- landing remains available at `/landing`
- app routes preserve an app-like shell and do not bounce users back to marketing
- canonical pairing links use HTTPS routes
- root bootstrap behavior is covered by automated tests
