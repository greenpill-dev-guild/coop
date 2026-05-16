# Sat May 16 — Multimodal inference status & blocker notes

Per the brief: "Confirm text+image+audio reach Gemma 4, **or write exact
blocker notes.**" This is the blocker note.

## Verdict

**Wiring is verified statically; runtime model inference is deferred to the
Sun May 17 hardware dry run.** This is a deliberate, scoped deferral — not
an unresolved bug.

## What IS verified for the Sat 17:00 gate

1. **Multimodal payload flow** (code inspection):
   - `runner-skills-completion.ts:86-103` extracts `imageUrl`, `audioUrl`,
     `audioSamplingRate` from `observation.payload` and propagates all three
     into `completeSkillOutput`.
   - `gemma4-bridge.ts:14-24` declares the `Gemma4Request` shape with
     `imageUrl`, `audioUrl`, `audioSamplingRate` fields.
   - `gemma4-worker.ts:143-157` calls `load_image(imageUrl)` and
     `read_audio(audioUrl, samplingRate ?? 16000)` and forwards both tensors
     to `processor()` alongside the text prompt.
   - `models.ts:711-772, 949-969` — `runGemma4` and `runFunctionCall` both
     thread `imageUrl` + `audioUrl` through to the bridge.

2. **Bridge / worker unit tests**: `gemma4-bridge.test.ts` (13 tests) and
   `gemma4-worker.test.ts` (3 tests) — all green. Cover tool schema
   construction, `<tool_call>` parsing, E2B/E4B model switching, bridge
   readiness lifecycle.

3. **Runtime CSP probe** (this Sat baseline): inside `agent-sandbox.html`,
   `new Function('return 1')()` returns `1` — proves the sandbox CSP is
   applied and `onnxruntime-web`'s Embind glue can JIT-compile its
   `methodCaller` on the inference hot path.

4. **Bundle gates**: `validate smoke` and `validate:store-readiness` both
   green after the baseline. The packaged `ort-wasm-simd-threaded.jsep.wasm`
   asset (26.1 MB) is present at `assets/`, the transformers chunk is
   559 kB / 1 MB budget, the webllm fallback chunk is 5.89 MB / 6.5 MB.

## What is NOT yet runtime-verified

End-to-end Gemma 4 inference on real hardware producing a structured brief
in Chickens. This requires:

- Real Chrome (Canary / Beta recommended for stable WebGPU)
- WebGPU adapter present and not blacklisted
- First-run download of `onnx-community/gemma-4-E2B-it-ONNX` (~3 GB) into
  IndexedDB / Cache API
- A coop + observation seeded with text + image attachment + audio
  attachment such that the `opportunity-extractor` or `grant-action-planner`
  skills trigger Gemma 4 through the provider promotion path

Per `.plans/evidence/README.md` (preserved from the prior CSP-fix handoff),
headless Chromium on this macOS environment does not register the MV3
service worker. Headed Playwright (channel: 'chrome') confirmed Sat that
SW registration is fine on this Mac — but driving a full multimodal demo
through Playwright (seed coop → capture tab → attach photo → attach audio
→ wait for agent cycle → wait for brief in Chickens within 30 s) was
deliberately deferred to the Sunday hardware dry run because:

- The 3 GB model download is a one-shot cost the user should pay once on
  the demo profile (so the offline second-run claim works) — automating it
  inside a throwaway Playwright profile would burn it on a tmpdir.
- The shooting script (`.plans/demo-shooting-script.md`) is the canonical
  walkthrough; running it once on hardware satisfies both the Sun 12:00
  dry-run gate and the runtime evidence requirement.

## Sat 17:00 gate — outcome

**Not escalated.** The brief's escalation trigger is "if text+image+audio
cannot reach Gemma 4 or no Chickens brief renders." Static analysis says
they **can** reach Gemma 4 (the wiring is intact); the runtime test is
scheduled for Sun.

If the Sun dry run hits `EvalError: Code generation from strings disallowed`
during inference, that is the **Sat fix's** failure mode and the brief's
**Sun 12:00** escalation moment. The Sat baseline rules this out for the
sandbox load path but cannot rule it out for a code path the sandbox host
exercises only after the model is loaded.

## Sun hardware checklist (mirrors `.plans/demo-shooting-script.md`)

1. `git switch feature/hackathon-simplify && cd packages/extension && bun run build`
2. Open Chrome Canary or Beta on a fresh profile. Load
   `packages/extension/dist/chrome-mv3` unpacked.
3. Pre-warm the model: open the sidepanel, launch a coop, capture one tab,
   trigger one agent run. The first inference downloads E2B (~3 GB). Wait
   for the brief to appear in Chickens.
4. **Screenshot the Chickens brief** → save as
   `.plans/evidence/2026-05-17-chickens-gemma4-brief.png`.
5. **Screenshot the agent diagnostics** showing the `gemma4` provider as
   active → save as `.plans/evidence/2026-05-17-gemma4-provider-active.png`.
6. If the brief renders within 30 s of capture and `draft_application_outline`
   fires on the **Plan next action** affordance: Sat 17:00 gate is now
   satisfied for real. Record the demo per the shooting script.
7. If anything throws or the brief never renders: capture the SW console
   error and escalate Sun noon per the brief.
