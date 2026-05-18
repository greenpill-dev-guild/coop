# QA Report — Regen Community Evals

## QA Pass 1: Codex

- Status: Passed on 2026-05-18.
- Browser/model proof:
  - Browser: Brave Browser `148.0.7778.167`
  - Model: `onnx-community/gemma-4-E2B-it-ONNX`
  - Source: remote Hugging Face load through Transformers.js browser cache
  - Runtime: `q4f16` on `webgpu`
  - Evidence: `.plans/evidence/2026-05-18T20-11-17-042Z-gemma4-regen-community-evals.json`
- Commands:
  - Passed: `bun run test:unit:coop-seeded-eval`
  - Passed: `bun run validate coop-seeded-eval`
  - Passed: `bun run test -- scripts/__tests__/verify-gemma4-regen-evals.test.ts packages/extension/src/runtime/agent/__tests__/gemma4-worker.test.ts`
  - Passed: `cd packages/extension && bun run build`
  - Passed: `COOP_VERIFY_BROWSER=brave bun run validate regen-community-evals`
  - Passed: `bun run plans validate`
- Findings:
  - The deterministic seeded matrix covers 32 group/action/variant cases and passes.
  - Brave loads the built extension, reaches `agent-sandbox.html`, initializes Gemma 4, and completes all
    32 regen community model-in-loop cases serially.
  - The verifier now has a smoke mode for 1-case or 2-case browser checks without weakening the full
    32-case gate.
  - Full-mode validation now defaults to raw model-output validation: `COOP_REGEN_EVAL_ALLOW_NORMALIZATION=1`
    is required for non-gating diagnostics that allow cleanup.
  - The verifier lazily loads Playwright only inside the browser-running path, so unit imports do not trigger
    Playwright webServer side effects or noisy `ECONNREFUSED localhost:3000` output.
  - Privacy leak detection now checks each stress/privacy/noise case for the full synthetic private token,
    gate code fragments like `5521`, phone fragments like `555-0199`, and private email fragments like
    `private@example.test` in public sections.
  - Browser evidence records WebGPU availability, browser/version, model source, dtype/device, init duration,
    per-case generation duration, raw output, parsed action brief, validation failures, warnings,
    normalizations, sampled page/browser events, retry counts, and browser event counts.
  - The final 2026-05-18 full gate passed 32/32 with zero warnings, zero final normalizations, and
    `allowNormalization: false`.
  - Three cases used an in-browser retry before final validation: two for empty-string placeholders and one for
    malformed JSON. The accepted final outputs had zero normalizations and no failures.
  - The verifier now requires canonical cases to include `privateNotes: []` and stress/privacy/noise cases to
    include exactly one non-empty redacted private note.

### Optional Local Model Source

Remote browser cache was sufficient for the green run, so no model weights were added to the repo. If remote
asset fetch becomes unreliable, keep a Hugging Face snapshot outside the repo and serve only the required
`q4f16` model subset from a local static server, then run:

```bash
COOP_REGEN_EVAL_MODEL_SOURCE=local \
COOP_REGEN_EVAL_LOCAL_MODEL_PATH=http://127.0.0.1:8765/ \
COOP_VERIFY_BROWSER=brave \
node scripts/verify-gemma4-regen-evals.cjs
```

The served root must contain the model path expected by Transformers.js, for example
`onnx-community/gemma-4-E2B-it-ONNX/...`. Do not place model artifacts in the extension package or repo.

## QA Pass 2: Claude

- Status: Ready for review after QA pass 1.
- Commands:
  - Pending.
- Findings:
  - Pending.

## Residual Risk

- The model-in-loop gate depends on a real Chromium-family browser, WebGPU, and Gemma 4 model asset
  availability. It is intentionally not a lightweight CI-only gate.
- Full validation takes roughly ten minutes on this machine because the 32 Gemma cases run serially in the
  browser sandbox.
- Raw Gemma output can still produce repairable JSON defects. The full gate now retries inside the browser, but
  the accepted final action brief must validate without normalization; any non-zero final normalization count
  fails the gate by default.
