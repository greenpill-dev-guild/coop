# QA Report — Regen Community Evals

## QA Pass 1: Codex

- Status: Partially run on 2026-05-17/2026-05-18.
- Commands:
  - Passed: `bun run test:unit:coop-seeded-eval`
  - Passed: `bun run validate coop-seeded-eval`
  - Passed: `cd packages/extension && bun run build`
  - Passed: `bun run plans validate`
  - Passed: `bun run validate regen-community-evals --dry-run`
  - Failed: `node scripts/verify-gemma4-regen-evals.cjs`
- Findings:
  - The deterministic seeded matrix now covers 32 group/action/variant cases and passes.
  - Brave can load the built extension and reach `agent-sandbox.html`.
  - Gemma 4 initialization reached "model ready" after allowing `blob:` scripts in the sandbox CSP.
  - Full model-in-loop completion remains blocked: the browser-local generation path timed out/hung before
    producing valid action brief JSON across the matrix.

## QA Pass 2: Claude

- Status: Blocked on QA pass 1.
- Commands:
  - Pending.
- Findings:
  - Pending.

## Residual Risk

- The model-in-loop gate depends on a real Chromium-family browser, WebGPU, and Gemma 4 model asset
  availability. It is intentionally not a lightweight CI-only gate.
- The completion gate is intentionally still hard-fail until Gemma 4 produces valid action briefs, not merely
  initializes.
