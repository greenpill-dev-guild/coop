# Context For Modern CSS Web UI Primitives

## Existing References

- `/Users/afo/Documents/Codex/2026-05-23/i-m-watching-this-great-video/modern-css-web-ui-audit.md`
- `.plans/README.md`
- `.plans/archive/completed/pwa-native-feel.todo.md`
- `.plans/archive/migrated/ui-quality-hardening.todo.md`
- `.plans/archive/migrated/receiver-design-polish.md`
- `.plans/features/ux-surface-clarity/`
- `DESIGN.md`

## Relevant Codepaths

- `packages/shared/src/styles/tokens.css`
- `packages/shared/src/styles/a11y.css`
- `packages/app/src/styles.css`
- `packages/app/src/app.tsx`
- `packages/app/src/components/BottomSheet.tsx`
- `packages/app/src/views/Landing/index.tsx`
- `packages/extension/src/global.css`
- `packages/extension/src/views/Popup/popup.css`
- `packages/extension/src/views/shared/Tooltip.tsx`

## Constraints

- This pack tracks modern CSS/Web UI adoption only; it does not authorize runtime CSS changes yet.
- Keep product simplification work in `ux-surface-clarity` closed and do not reopen it for CSS standards.
- Preserve app, extension, popup, sidepanel, and shared-token boundaries.
- Avoid global scrollbar hiding as a default unless a future implementation proves the surface needs it.
- Treat overscroll gestures, HTML-in-Canvas, CSS `@function`, CSS `if()`, and broad style-query architecture as research only.
- Any future visual changes must keep Coop's warm, local-first product language and not become a generic SaaS redesign.

## Notes For Agents

- Claude should focus on UI primitives, CSS token adoption, browser-native dialog/popover behavior, tooltip ergonomics, scroll behavior, and visual/accessibility proof.
- Codex should focus on shared token validation, plan status, automated checks, and any future non-visual guardrail wiring.
- Shared assumption: modern primitives must be feature-detected or have static fallbacks when browser support is limited.
- Preference support must be concrete: `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`, `color-scheme`, large text, keyboard focus, and touch targets should be verified per changed surface.
