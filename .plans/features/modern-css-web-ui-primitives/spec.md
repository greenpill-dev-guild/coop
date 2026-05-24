# Modern CSS Web UI Primitives

**Feature**: `modern-css-web-ui-primitives`
**Status**: Backlog
**Source Branch**: `main`
**Created**: `2026-05-24`
**Last Updated**: `2026-05-24`

## Summary

Create an execution-ready modernization pack for Coop's CSS and browser-native UI primitives. This is a planning and tracking pack first: future implementation should reduce hardcoded styling, replace fragile JS-heavy interaction code where browser primitives can do the work, and improve accessibility preference support without broad redesign.

## Why Now

- The cross-repo Web UI audit found Coop has the highest upside from token consolidation and native UI primitive cleanup.
- Coop already has shared tokens, dark mode, View Transitions, native popovers, and native dialog use, but implementation is uneven across app, extension, popup, and sidepanel surfaces.
- Several current interactions rely on manual JS scroll, resize, tooltip positioning, and bottom-sheet gesture handling that should be reviewed against newer browser primitives.

## Scope

### In Scope

- Token and hardcoded-value consolidation across app and extension CSS.
- Text-scale readiness before adding `<meta name="text-scale" content="scale">`.
- Explicit `prefers-contrast` and `forced-colors` audit for shared tokens, app surfaces, popup/sidepanel chrome, dialog/sheet overlays, focus rings, status pills, and hidden-scrollbar areas.
- Global scrollbar policy review and replacement with explicit scroller behavior where appropriate.
- Native `<dialog>` and `popover` primitive policy, including progressive `closedby="any"` evaluation.
- Bottom-sheet cleanup plan that can eventually absorb future overscroll gestures without adopting that API now.
- Tooltip/popover modernization plan for extension surfaces, with JS fallback where extension constraints require it.
- Scroll-state or scroll-triggered CSS pilots where they can replace low-value JS listeners with static fallbacks.

### Out Of Scope

- No runtime CSS or component changes in this plan-tracking pass.
- No deletion of current app, extension, agent, or advanced capability surfaces.
- No new CSS framework, design-system package, or broad rebrand.
- No API, contracts, storage, or live-rails behavior changes.
- No production use of overscroll gestures, HTML-in-Canvas, CSS `@function`, CSS `if()`, `corner-shape`, `shape()`, `border-shape`, or `fit-text`.

## User-Facing Outcome

- Future Coop surfaces feel more consistent across app, popup, sidepanel, and shared components.
- Dialogs, sheets, tooltips, and scroll affordances behave more like browser-native UI while preserving accessibility.
- Larger text, reduced motion, and high-contrast preferences are easier to support.

## Technical Notes

- UI lane owns most runtime CSS and component primitive work.
- State lane owns only shared token guardrails, validation wiring, or CSS-quality tooling if future implementation needs it.
- API and contracts lanes are `n/a`.
- Docs lane records the compatibility ladder and durable guidance once implementation scope is approved.
- QA starts only after UI/state/docs lanes produce evidence or explicit deferrals.

## Lane Split

| Lane | Agent | Expected Scope |
|------|-------|----------------|
| UI | Claude | CSS inventory, token adoption, scrollbar policy, dialog/sheet/tooltip/scroll primitive plan and later implementation |
| State | Codex | Shared token guardrails, validation wiring, and non-runtime CSS quality checks |
| API | Codex | Not applicable |
| Contracts | Codex | Not applicable |
| Docs | Codex | Compatibility ladder and durable guidance updates |
| QA 1 | Codex | Validation and implementation integrity |
| QA 2 | Claude | UX, accessibility, visual sweep, and manual browser/extension confirmation |

## Acceptance Criteria

- [ ] Modern CSS feature-readiness ladder is recorded for Coop.
- [ ] Token consolidation plan separates semantic drift from intentional local art direction.
- [ ] Preference-mode audit covers reduced motion, large text, high contrast, and forced colors without relying on color-only or shadow-only state.
- [ ] Global scrollbar policy is explicit and avoids blanket hiding unless justified per surface.
- [ ] Bottom-sheet/dialog primitive policy preserves focus, escape, light-dismiss, and reduced-motion behavior.
- [ ] Tooltip/popover modernization preserves extension constraints and has a fallback path.
- [ ] Scroll-state or scroll-triggered pilots are scoped to non-essential behavior.
- [ ] Text-scale readiness is proven before enabling the meta tag.
- [ ] QA handoff order is explicit and validation evidence is recorded.

## Validation Plan

- Unit: targeted tests for any future component or token-guardrail changes.
- Integration: `bun run validate quick` for runtime implementation lanes when touched.
- Plan: `bun run plans validate` after plan updates.
- Manual: Chrome extension/app visual checks for popup, sidepanel, app bottom sheet, landing scroll behavior, and large text scale before closing runtime work.

## References

- Related docs: `.plans/README.md`, `DESIGN.md`, `docs/reference/coop-design-direction.md`
- Relevant files: `packages/shared/src/styles/tokens.css`, `packages/app/src/styles.css`, `packages/extension/src/global.css`, `packages/extension/src/views/Popup/popup.css`
- Open questions: whether text-scale should land first in the app, extension, or both after proof.
