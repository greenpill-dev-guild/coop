---
name: browser-verification
user-invocable: true
description: Browser and visual verification for Coop app, extension, popup, sidepanel, and receiver flows. Use when UI changes need rendered proof, console inspection, screenshots, Playwright checks, or local browser debugging.
argument-hint: "[app|extension|popup|sidepanel|receiver|docs]"
version: "1.0.0"
status: active
packages: ["app", "extension", "docs"]
dependencies: ["ui-compliance", "testing"]
last_updated: "2026-05-15"
last_verified: "2026-05-15"
---

# Browser Verification Skill

Rendered UI proof for Coop. Use this before claiming that a visual, interaction, or browser-runtime fix works.

This skill does not replace tests. It catches the things static checks miss: blank screens, clipped popup content, console errors, broken focus, missing assets, and sidepanel layout regressions.

---

## Activation

| Trigger | Action |
|---------|--------|
| UI files changed | Run rendered browser verification before reporting done |
| Popup or sidepanel behavior changed | Verify extension surface at realistic dimensions |
| CSS, token, layout, or animation changed | Capture screenshot proof and inspect console |
| Receiver/PWA flow changed | Verify app route and responsive state |
| Visual QA requested | Use Playwright or browser automation and report proof limits |

## Scope Selection

| Surface | Start Command | Primary Checks |
|---------|---------------|----------------|
| App / receiver PWA | `bun dev:app` | Routes render, responsive layout, console clean |
| Extension build | `cd packages/extension && bun run build` | MV3 output exists, no build/runtime errors |
| Extension dev | `bun dev:extension` | Popup/sidepanel render in Chromium |
| API-backed flows | `bun dev:api` | Pairing, sync, receiver handoff |
| Docs | `bun run docs:dev` | Docs route renders under Node 22/mise |

Prefer the smallest surface that proves the change. Use full E2E only when the user path crosses surfaces.

---

## Verification Workflow

### 1. Identify the Rendered Surface

Map changed files to the UI surface:

- `packages/extension/src/views/Popup/**` -> popup
- `packages/extension/src/views/Sidepanel/**` -> sidepanel
- `packages/app/src/**` -> app or receiver PWA
- `packages/shared/src/styles/**` -> app and extension downstream checks
- `docs/**` -> docs site

If the changed file is shared styling or a shared UI contract, verify at least one downstream consumer.

### 2. Run the Right Local Target

Use the lightest target first:

```bash
cd packages/extension && bun run build
bun dev:app
bun dev:api
```

For automated coverage:

```bash
bun run test:visual
bun run test:e2e:popup
bun run test:e2e:extension
bun run test:e2e:app
```

### 3. Inspect the Browser

Use available browser automation or manual Chrome inspection to verify:

- The target route or extension surface is not blank.
- Console has no new errors.
- Primary actions are clickable with mouse and keyboard.
- Focus order is coherent.
- Text fits at narrow and standard widths.
- Loading, empty, error, and success states still render when relevant.
- Animations respect `prefers-reduced-motion` when touched.

For popup checks, verify the 400px fixed-width constraint. For sidepanel checks, verify narrow and wider panel widths when layout changed.

### 4. Capture Proof

Report proof in the final or handoff:

```markdown
### Browser Verification
- Surface: popup / sidepanel / app / docs
- Target: http://127.0.0.1:3001/... or extension dev window
- Checks: rendered, primary action, console, responsive width
- Evidence: screenshot path or Playwright command
- Limits: anything not covered
```

Never say "looks good" without naming what rendered and what was checked.

---

## Common Failure Modes

| Symptom | Likely Cause | Next Check |
|---------|--------------|------------|
| Blank popup | Extension build/runtime error | Inspect extension console and `cd packages/extension && bun run build` |
| Sidepanel clips content | Fixed width or missing container constraints | Test 300px and 800px widths |
| Click works, keyboard fails | Non-semantic interactive element | Use `ui-compliance` checks |
| Test passes, visual broken | Assertion missed layout or asset state | Add screenshot or DOM visibility assertion |
| App works, extension fails | MV3/runtime mismatch | Check service worker constraints and extension console |

## Related Skills

- `ui-compliance` -- Accessibility, focus, responsive, and reduced-motion checks.
- `testing` -- Vitest and Playwright test strategy.
- `design` -- Coop visual language and surface-specific interaction rules.
- `debug` -- Root cause investigation when rendered proof fails.
