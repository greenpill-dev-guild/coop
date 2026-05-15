# Goal-Mode Prompt: Hackathon Hyper-Simplify

## Goal 1 retrospective — what landed, what didn't (audit Fri May 15 ~09:40 PDT)

**Landed (11 commits on `feature/hackathon-simplify`, net −1,584 lines):**
- Hook copy live: popup, sidepanel empty state, landing hero (`22e7300`).
- `@huggingface/transformers` bumped to `^4.2.0` (`abf045f`).
- Gemma 4 multimodal provider + function-call routing wired (`e986129`).
- ONNX wasm resolution through `onnxruntime-web` for transformers v4 (`1ce19cd`).
- Six tool schemas + new `grant-action-planner` skill with eval fixture (`62b9bc9`, `d560040`).
- Multimodal attachments (`imageUrl`, `audioUrl`, `audioSamplingRate`) piped from observation through `completeSkill` → `runGemma4` (`d89f589`).
- README §"Submission" (441w) + ARCHITECTURE.md (1,667w across 7 sections) (`7bb7c78`).
- Smoke + store-readiness green via JSEP wasm budget bump and `new Function()` allowlist on three worker chunks (`d560040`).
- Honest comment on the allowlist trade-off (`1aaa805`).
- Zod→JSON-Schema auto-generation captured as roadmap (`885343f`).
- 75-second demo shooting script at `.plans/demo-shooting-script.md` (`39a117e`).

**Critical gap — CSP / `new Function()` (blocking the demo):** The store-readiness allowlist in `scripts/store-readiness.ts` is explicitly self-described as "a HACKATHON-ONLY relaxation: it does not make the runtime actually work in a packaged extension." `onnxruntime-web`'s Embind glue JIT-compiles a `methodCaller` via `new Function()` in the inference hot path. MV3's default `extension_pages` CSP (`script-src 'self' 'wasm-unsafe-eval'`) forbids that. So Gemma 4 will throw `EvalError: Code generation from strings disallowed` the first time the worker runs inference. The shooting script knows this — pre-flight step 2 says the user must manually enable `'unsafe-eval'` in `wxt.config.ts` before recording. **This needs a deliberate fix, not a one-time toggle.**

**Significant gaps:**
- **Lazy-loading not done.** No dynamic `import()` of `erc8004`, `fvm`, `stealth`, `privacy`, `archive`, `policy`, `greengoods` in extension/app source. Day 2 of Goal 1 didn't land. Bundle stayed at ~50 MB.
- **Bundle delta never measured.** Goal 1 required `before/after` numbers in commit messages; none reported.
- **Back-half skill function-calling migration not done.** Six demo-path tool schemas exist in `gemma4-bridge.ts`. The 10 back-half skills (`memory-insight`, `publish-readiness`, `entity-extraction`, `ecosystem-entity-extractor`, `capital-formation-brief`, `erc8004-registration`, `erc8004-feedback`, `greengoods-assessment`, `greengoods-work-approval`, `greengoods-gap-admin-sync`) still on JSON-schema fallback. This is an *acceptable* cut per the ladder but should be documented in ARCHITECTURE.md.
- **End-to-end real-Chrome dry run not verified.** Image + audio + text → brief in Chickens has not actually been walked on hardware (the shooting script lists it as the pre-flight unknown).

**Cleanup hygiene:**
- 37 modified files uncommitted on `main` (mostly `.claude/`, `.codex/`, `AGENTS.md`, `CLAUDE.md` plus a few extension test files). These would pollute the submission repo's `git status` if judges clone and check.
- 40 orphan `worktree-agent-*` branches, several with unsaved state. Several `fix/sync-remediation-*` branches and a `codex/coop-hackathon-plan` parallel feature also visible.

## Next goal — Unbreak the runtime and close Day 2 (≤4000 chars, paste into goal mode)

```text
MISSION: The first goal landed Gemma 4 in code but the runtime won't actually execute on a fresh MV3 install (CSP forbids `new Function()` on onnxruntime-web's hot path). Make the demo run on real Chrome, close the lazy-load gap from Day 2, walk the end-to-end arc on hardware, and clean the repo for submission. Same deadline: Mon May 18 2026. Same branch: `feature/hackathon-simplify`.

FIRST: read `.plans/i-would-like-your-smooth-whistle.md` — full audit + Goal 1 brief is there. The Goal 1 retrospective lists exactly what landed and what didn't.

PRIMARY: Fix the CSP/new-Function trap so Gemma 4 inference actually executes when an unpacked extension is loaded into Chrome. Pick the cheapest path that works for the demo recording surface, in this order:
  (a) Sandboxed iframe worker — host the agent worker in a sandbox page with its own CSP (`script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'`). MV3 supports `sandbox.pages` in manifest. This is the right architectural answer and survives Web Store submission.
  (b) If (a) blows past Sat noon, fall back to a `wxt.config.ts` manifest override with `extension_pages: "... 'unsafe-eval' ..."` for the demo build only; mark the build with a `COOP_DEMO_CSP=1` env gate so the Web Store build path is unaffected. Document the limitation in README and ARCHITECTURE.md.
  (c) Custom onnxruntime-web rebuild — document as roadmap only.

After fix: load the unpacked extension in a fresh Chrome profile, force one Gemma 4 inference, confirm no `EvalError` in DevTools, save a screenshot of the brief in Chickens to `.plans/evidence/`.

SECONDARY (Sat): Lazy-load seven heavy modules reachable from simple mode: `@coop/shared/modules/erc8004`, `fvm`, `stealth`, `privacy`, `archive`, `policy`, `greengoods` operator rails. Use `await import()` at the use site, never at top-level. Build before+after; report bundle delta in the commit (baseline ~50 MB, target ≥20% reduction).

TERTIARY (Sun morning, before recording): Walk the full arc on real Chrome with image+audio+text inputs (grant tabs are listed in `.plans/demo-shooting-script.md`). Brief renders in Chickens within 30s; `draft_application_outline` fires; push-to-coop lands artifact in feed; total ≤75s on screen.

CLEANUP (anytime, batchable):
- Decide the fate of the 37 modified files on `main` (mostly `.claude/`, `.codex/`, `AGENTS.md`, `CLAUDE.md`). Either commit to a separate `chore/agent-infra` branch off main or stash with a labeled stash. Do NOT bring them into `feature/hackathon-simplify`.
- Delete the 40+ orphan `worktree-agent-*` branches after confirming no unsaved state (`git branch | grep worktree-agent | xargs -L1 git log -1 --format='%h %s' --` first). Skip any with uncommitted refs.

DOCS: Update README and ARCHITECTURE.md to honestly describe the CSP fix path chosen, plus the back-half skills that remain on JSON-schema fallback (this is the documented scope cut).

VERIFY EACH COMMIT: `bun run validate quick`. Build the extension and load it in a fresh Chrome profile when CSP, inference, or worker boundaries change. Screenshot the brief in Chickens after the runtime fix; attach to commit message.

ESCALATE: Sat noon if sandboxed-iframe path can't load Gemma 4. Sat EOD if lazy-load doesn't measurably reduce the bundle. Sun noon if the real-Chrome dry run can't complete the arc.

DONE: Gemma 4 inference runs in real Chrome with no `EvalError`; screenshot in `.plans/evidence/` proves it. Bundle is measurably smaller. Demo arc walks end-to-end on hardware with image+audio+text. Repo is clean (no orphan worktree branches, no straggler main-branch mods). README + ARCHITECTURE.md describe the CSP path honestly. `bun run validate smoke` and `:store-readiness` still green. Ready for Sunday recording slot.

START NOW with the CSP fix — sandboxed iframe first.
```

## Compressed goal condition (≤4000 chars — paste this into goal mode)

```text
MISSION: Ship Coop for The Gemma 4 Good Hackathon (Kaggle, climate/resilience track) by EOD Mon May 18 2026. Deliverables: public repo on `feature/hackathon-simplify`, 60-90s demo video, README submission section, ARCHITECTURE.md.

FIRST: read `.plans/i-would-like-your-smooth-whistle.md` for code snippets, per-skill order, file pointers, scope-cut ladder. This goal condition is the compaction anchor.

BRANCH: cut `feature/hackathon-simplify` from main. Small conventional commits. No merge without my OK.

DEMO ARC (the spine):
1) Fresh popup hook: `Chicken or egg? Neither — you need a coop first.` Single CTA: `Launch the Coop`.
2) Launch coop "Community Garden Grants".
3) Capture 3-4 grant tabs (text).
4) Attach a grant-site screenshot (image — Gemma 4 reads the visual).
5) Attach a 10-15s voice memo from a garden meeting (audio — Gemma 4 transcribes, uses as fit context).
6) Gemma 4 surfaces a brief in Chickens (title/deadline/eligibility/fit/why). One function call `draft_application_outline` fires on camera.
7) Push to coop; members see in feed.
8) Closing: opportunities found, captured, shared by the flock — local-first, offline, multimodal, low-bandwidth.

GEMMA 4: `onnx-community/gemma-4-E2B-it-ONNX` default, `-E4B-it-ONNX` quality fallback. q4f16 + webgpu via `@huggingface/transformers` (`Gemma4ForConditionalGeneration` + `AutoProcessor` + `load_image` + `read_audio`). Run in a dedicated worker `agent-gemma4-worker.ts`. Add a `gemma4` provider to `provider-contracts.ts`. Keep the Qwen path at `models.ts:32` as fallback. Bump `@huggingface/transformers` only if multimodal exports missing.

FUNCTION CALLING: migrate all 16 skills to Gemma 4 native function calling. Demo-path by Sat noon: opportunity-extractor, grant-fit-scorer, tab-router, theme-clusterer, review-digest, plus NEW `grant-action-planner` (the on-camera tool call). Back half best-effort by Sat EOD. Keep `validateSkillOutput` as type guard.

DAYS:
- Fri D1: Gemma 4 loads on-device; multimodal worker round-trips image+audio+text; opportunity-extractor + grant-fit-scorer migrated; hook copy live in popup/sidepanel/landing.
- Sat D2: all 6 demo-path skills migrated by noon; lazy-load erc8004/fvm/stealth/privacy/archive/policy/greengoods-operator from simple-mode bundle; report delta; demo walks end-to-end.
- Sun D3: record 60-90s video (hook in first 7s, function call on camera); write README (300-500w) + ARCHITECTURE.md (1500-2500w); validate smoke + store-readiness green; freeze.
- Mon: submit only.

LITERAL COPY (no coop yet): `Chicken or egg? Neither — you need a coop first.` CTA `Launch the Coop`. Old `Round up your loose chickens` only renders once a coop exists.

OUT OF SCOPE: no deletions, no new deps (only transformers bump if needed), no edits to contracts/permit/session/onchain/policy/archive beyond lazy-loading, no api server changes, no new flags, no popup redesign.

SCOPE-CUT LADDER (apply autonomously). Never cut: hook copy → on-device Gemma 4 → video → simple-mode default → demo arc. First cuts: back-half function-call migration → audio modality → ARCHITECTURE.md depth (1000w floor) → E4B work → lazy-load scope. Two cuts hit → escalate.

VERIFY each commit: `bun run validate quick`. UI changes → build + reload + screenshot. Inference changes → real Chrome image+audio+text run; brief lands in Chickens. Skill migrations → targeted test + `runner-skills.ts` smoke.

ESCALATE: Fri EOD if Gemma 4 won't load or multimodal won't round-trip. Sat noon if demo-path skills not all migrated. Sat EOD if bundle reduction <20% or two cuts hit. Sun noon if dry run breaks or ARCHITECTURE.md <1000w.

DONE: branch pushed; smoke + store-readiness green; video URL exists; README + ARCHITECTURE.md written; hook live; Gemma 4 is the live model; demo-path skills run via function calling; the arc walks with image+audio+text producing an on-device brief and one function call.

START: read the brief, then Day 1.
```

## Context

Afolabi is submitting Coop to **The Gemma 4 Good Hackathon** on Kaggle (Google DeepMind + Kaggle, $200K prize pool) by **Mon May 18, 2026** (3 days from today, Fri May 15). The hackathon focuses on real-world impact in **health, education, climate, and global resilience**, emphasizing on-device inference, low bandwidth, and Gemma 4's native multimodal + function-calling capabilities. Required submission: public GitHub repo, working demo, short video, and a technical write-up.

This plan crafts a single, compaction-resilient prompt for Claude Code's **goal mode**. The goal-mode session will run on a dedicated branch with full implementation authority. The prompt drives a focused 3-day sprint, not an open-ended refactor.

Coop's existing simplification work (`.plans/features/ux-surface-clarity/`) already shipped a `uiMode: 'simple' | 'advanced'` toggle with simple-mode render gates done across Roost, Chickens, Coops, Nest, and Popup. The hackathon push **builds on top of that**: it does not redo it.

The garden-grants demo arc maps directly to the hackathon's climate / global-resilience focus area — community gardens are a frontline climate-adaptation surface, and grant discovery is a low-bandwidth, on-device-friendly task. The demo intentionally exercises all three Gemma 4 input modalities (image of a grant site, audio from a community meeting voicing needs, and text from captured tab metadata) and uses Gemma 4 native function calling across the agent skill surface — both highlighted by Kaggle as Gemma 4 differentiators.

## Key decisions (and why)

1. **Anchor on the demo, not "simplification."** Three days is too short to chase a quality attribute like DRY. Every iteration verifies against one demo beat: garden-grants research → Gemma drafts a brief → push to coop. UI surfaces not on that path get hidden, not polished.

2. **Gemma 4 E2B-it-ONNX is the swap target.** Confirmed via Hugging Face: `onnx-community/gemma-4-E2B-it-ONNX`, q4f16 quantization, `webgpu` device, 128k context window, native system role, multimodal (text/image/audio in, text out). Loaded with `Gemma4ForConditionalGeneration` + `AutoProcessor` from `@huggingface/transformers` (already a dep at ^3.8.1 — version bump may be required for `Gemma4ForConditionalGeneration` class; allow it). MLC WebLLM does not yet support Gemma 4 (issue #810 open), so the transformers.js path is the right one. The bigger E4B variant exists but E2B is the right starting point given browser memory budgets.

3. **Pin the chicken-or-egg copy verbatim** so the agent doesn't paraphrase. The line is the 7-second hook for the demo opener, the popup empty state, and the landing-page hero: *"Chicken or egg? Neither — you need a coop first."*

4. **Hide + lazy-load only, no deletions, no dep changes.** This matches `ux-surface-clarity` decision D2 and respects the supply-chain safety rules in `CLAUDE.md`. Heavy modules (`erc8004`, `fvm`, `stealth`, `privacy`, `archive`, `greengoods` operator rails, `policy` action parsers) move to `import()`-deferred boundaries so the simple-mode bundle shrinks. Code stays in the repo.

5. **No numerical targets without baseline.** The agent measures bundle size and line counts on Day 1 entry, then targets relative deltas (-30% bundle, -25% lines in `runtime/agent/`) discovered after measurement.

6. **Daily milestones, not feature checklists.** Goal mode is more resilient when each compaction can re-read a per-day anchor.

7. **Full multimodal in the demo (image + audio + text).** Kaggle judges score multimodal use; the demo wires up all three Gemma 4 input modalities. The image input is a screenshot of a grant site (the visual context the user sees), the audio input is a short clip from a community meeting voicing what the garden needs, and the text input is captured tab metadata. The first two are out of scope for the existing Coop capture pipeline today but Gemma 4 + `AutoProcessor` handle them natively — the prompt scopes a minimal "attach a photo" and "attach a voice note" affordance in the demo flow only.

8. **Function calling across all agent skills.** Migrate the agent's structured outputs from the current `validateSkillOutput` JSON-schema path to Gemma 4 native function calling. This is a substantive refactor of the agent runner. It earns the strongest Gemma 4 story for judges and is what the user picked, knowing the blast radius. The prompt orders the migration demo-path-first so a partial landing still ships a clean demo.

9. **Scope-cut priority is pre-declared.** Three days, three multipliers (multimodal, function-call-all, ARCHITECTURE.md), and a demo to record. The prompt declares an explicit cut order so the goal-mode agent can self-resolve scope without escalating for every choice. Never cut: the hook copy, on-device Gemma 4, the video, simple-mode default, the demo arc. First cuts: scope of the function-call migration (drop to demo-path-only), then audio modality, then ARCHITECTURE.md depth, then E4B variant work (E2B alone).

## Critical files (pointers for the goal-mode agent)

- **Gemma swap point**: `packages/extension/src/runtime/agent/models.ts:32` — currently hardcodes `TRANSFORMERS_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct'`. The new ID is `onnx-community/gemma-4-E2B-it-ONNX`. The loading API differs from the current `pipeline('text-generation', ...)` path: Gemma 4 uses `Gemma4ForConditionalGeneration.from_pretrained(model_id, { dtype: 'q4f16', device: 'webgpu' })` with an `AutoProcessor`. This is a real refactor of the model loading, not a one-line swap. Provider abstraction at `packages/extension/src/runtime/agent/provider-contracts.ts:452` and the bridge at `webllm-bridge.ts` shape the right place to add a `gemma4` provider alongside `transformers` and `webllm` rather than mutating the existing transformers path.
- **Web worker entry**: `packages/extension/entrypoints/agent-webllm-worker.ts`, `packages/extension/src/runtime/inference-worker.ts`.
- **Empty-state copy** (`Round up your loose chickens` today): `packages/extension/src/views/Popup/PopupHomeScreen.tsx:287`, `packages/extension/src/views/Sidepanel/tabs/ChickensTab.tsx:367`, `packages/extension/src/views/Popup/__tests__/PopupApp.test.tsx:153`.
- **Landing hero**: `packages/app/src/` (landing page surface).
- **UI render gates** (already gating advanced): `packages/extension/src/views/Sidepanel/tabs/RoostTab.tsx`, `RoostAgentSection.tsx`, `CoopsTab.tsx`, `NestTab.tsx`, `NestSettingsSection.tsx`.
- **uiMode preference**: `packages/shared/src/contracts/schema-coop.ts`, `packages/extension/src/background/context-ui.ts`.
- **Lazy-load candidates** (currently eager-imported via `@coop/shared` barrel): `packages/shared/src/modules/{erc8004,fvm,stealth,privacy,archive,greengoods,policy}`.

## Verification (how the user confirms it worked)

After the goal-mode session reports done, the user should:

1. `git switch feature/hackathon-simplify` and `bun install && bun run build`.
2. Load the unpacked extension in Chrome. Open the popup on a fresh profile. Confirm the empty state reads the chicken-or-egg line and the only action is launching a coop.
3. Walk the demo: open 3–4 tabs of community garden grant pages → wait for the agent to surface a draft in Chickens → review → push to a coop.
4. Confirm the model running is a Gemma variant (check `provider-promotion.ts` logs in DevTools or the Roost diagnostics in advanced mode).
5. Verify the recorded demo video lands the chicken-or-egg hook in the first 7 seconds.
6. `bun run validate smoke` and `bun run validate:store-readiness` both green.

If any of the above fails, the goal-mode session has not landed. Re-engage it with the specific failure.

## The prompt (copy verbatim into goal mode)

```text
MISSION
Ship a Coop submission for The Gemma 4 Good Hackathon (Kaggle + Google DeepMind, $200K prize pool, climate/resilience track) by end of day Mon May 18, 2026. Deliverables: public GitHub repo on branch `feature/hackathon-simplify`, a 60–90s demo video showing the garden-grants story arc with on-device Gemma 4, and a technical write-up in README.md. Optimize every iteration for that demo. Defer everything else.

BRANCH
Cut `feature/hackathon-simplify` from `main` on first run. Small, conventional commits per step. Do not merge to main without my approval.

DEMO ARC (the spine — every change must serve a beat)
1. Open popup on a fresh install. Hook: "Chicken or egg? Neither — you need a coop first." Single CTA: Launch the Coop.
2. Launch a coop named "Community Garden Grants."
3. Capture 3–4 browser tabs of garden grant pages (TEXT modality — tab metadata).
4. Attach a screenshot of one grant site that has an awkward PDF layout the tab capture missed (IMAGE modality — Gemma 4 extracts structured detail from the visual).
5. Attach a 10–15s voice memo from a community garden meeting: someone says "we need irrigation funding for the south plot before July" (AUDIO modality — Gemma 4 transcribes and uses it as fit-scoring context).
6. Gemma 4 surfaces an opportunity brief in the Chickens tab: title, deadline, eligibility, fit score, why-it-matters. Show this is fully on-device. Show one function call ("draft_application_outline") fire and produce a structured artifact.
7. Review the brief, push it to the coop. Members see it in the Coops feed.
8. Closing line ties back to chickens: opportunities found, captured, and shared by the flock — local-first, offline-capable, multimodal, made for communities working with low bandwidth.

GEMMA 4 SWAP — CONCRETE
- Models: `onnx-community/gemma-4-E2B-it-ONNX` (E2B, default) and `onnx-community/gemma-4-E4B-it-ONNX` (E4B, higher-quality fallback). Both instruction-tuned, ONNX, 128k context, native system role, multimodal in. Use `dtype: 'q4f16'` and `device: 'webgpu'`. Pick E2B unless E4B loads in under 60s and produces noticeably better briefs on the demo content; if so, default to E4B.
- Loader (in a worker, not the main thread):
  ```js
  import { AutoProcessor, Gemma4ForConditionalGeneration, TextStreamer, load_image, read_audio } from '@huggingface/transformers';
  const model_id = 'onnx-community/gemma-4-E2B-it-ONNX';
  const processor = await AutoProcessor.from_pretrained(model_id);
  const model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, { dtype: 'q4f16', device: 'webgpu' });
  // Multimodal inputs
  const image = await load_image(imageUrl);
  const audio = await read_audio(audioUrl, 16000);
  const messages = [{ role: 'user', content: [
    { type: 'image' }, { type: 'audio' }, { type: 'text', text: '<task and schema>' }
  ]}];
  const prompt = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
  const inputs = await processor(prompt, image, audio);
  const outputs = await model.generate({ ...inputs, max_new_tokens: 512, do_sample: false, streamer: new TextStreamer(processor.tokenizer, { skip_prompt: true }) });
  ```
- The current path in `packages/extension/src/runtime/agent/models.ts:32` uses `pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct')`. Do not mutate that path; add a new `gemma4` provider beside it via the abstraction at `provider-contracts.ts`. The Qwen path stays as a fallback for non-WebGPU browsers and tests.
- `@huggingface/transformers@^3.8.1` is already a dep. If `Gemma4ForConditionalGeneration`, `load_image`, or `read_audio` are not exported at the pinned version, bump the dep — that is the one allowed dependency change. Do not add other packages.
- Inference worker: `packages/extension/entrypoints/agent-webllm-worker.ts` or a new sibling `agent-gemma4-worker.ts` so the model lives off the main thread. MV3 service workers can host the model; reference the existing `webllm-bridge.ts` pattern.

FUNCTION CALLING MIGRATION — PER-SKILL ORDER
The agent has 15 skills with structured-JSON output today (see `models.ts` imports of `*Output` types). Migrate them to Gemma 4 native function calling in this order. Demo-path skills go first; if Day 2 EOD shows the back half is in trouble, the cut order kicks in (see scope-cut priority).

Demo-path (must migrate by Sat noon):
1. `opportunity-extractor` — extracts grant briefs from tab/image/audio context.
2. `grant-fit-scorer` — scores fit against coop priorities.
3. `tab-router` — routes captured tabs to skills.
4. `theme-clusterer` — clusters captures.
5. `review-digest` — summarizes Chickens queue.
6. NEW skill `grant-action-planner` — uses function calling to suggest `draft_application_outline`, `add_to_coop_calendar`, or `request_member_input` as callable actions. This is the on-camera function-call moment.

Back half (migrate by Sat EOD, demo-path-only if cuts hit):
7. `memory-insight` 8. `publish-readiness` 9. `entity-extraction` 10. `ecosystem-entity-extractor` 11. `capital-formation-brief` 12. `erc8004-registration` 13. `erc8004-feedback` 14. `greengoods-assessment` 15. `greengoods-work-approval` 16. `greengoods-gap-admin-sync`.

For each migrated skill: define the Gemma 4 tool/function schema, refactor the runner caller (`runner-skills.ts`, `runner-skills-prompt.ts`, `runner-skills-completion.ts`) to issue and parse tool calls, keep `validateSkillOutput` as the type-guard at the boundary, and add or update one test. Existing JSON-schema validators stay as the safety net — do not delete them.

DAY 1 (Fri May 15) — Gemma 4 worker, multimodal pipe, hook
- WebGPU sanity check on this host: load `https://huggingface.co/spaces/webml-community/Gemma-4-WebGPU` in Chrome. Confirm E2B and E4B both initialize within 60s. Note times. Pick default based on quality on a real grants page (E2B unless E4B is clearly better).
- Add a `gemma4` provider to `provider-contracts.ts` using the loader snippet above. Run inference in a dedicated worker (`agent-gemma4-worker.ts`) off the main thread. Wire into the existing provider promotion path. Keep the Qwen path as fallback.
- Verify `Gemma4ForConditionalGeneration`, `AutoProcessor`, `load_image`, `read_audio` are exported at the pinned `@huggingface/transformers` version. If not, bump the dep, commit it separately, run `bun run validate quick`.
- Multimodal worker plumbing: wire `load_image` and `read_audio` into the worker boundary so a skill can pass an image URL or an audio Blob in. The capture surface (a small "Attach photo" / "Attach voice memo" button next to the existing capture controls) can be minimal — used only for the demo, gated behind `uiMode === 'simple'` showing only after a coop exists. Reuse `popup-icon-button` styles.
- Migrate the first two skills to Gemma 4 function calling: `opportunity-extractor` (text + image + audio inputs) and `grant-fit-scorer`. Define their tool/function schemas, refactor their runner caller paths, keep the JSON validator as a type guard.
- Replace empty-state copy in three places — `PopupHomeScreen.tsx:287`, `ChickensTab.tsx:367`, and the test fixtures that expect `Round up your loose chickens` (search the repo; only update the *no-coop* surfaces, leave the loose-tab empty-state alone).
- Update landing-page hero in `packages/app/src/` to the same hook.
- Commit checkpoint: Gemma 4 running on-device, multimodal worker accepts text + image + audio, `opportunity-extractor` and `grant-fit-scorer` produce real briefs via function calling, hook copy live.
- Escalation: if Gemma 4 fails to load by Fri EOD, or if multimodal (image OR audio) cannot round-trip, tell me with the WebGPU adapter info and the specific error. Do not roll forward into Day 2 with a broken inference path.

DAY 2 (Sat May 16) — Function-call migration + lazy-load + surface tighten
- By Sat NOON: complete demo-path skill migrations (tab-router, theme-clusterer, review-digest) and add `grant-action-planner` (the new function-calling showcase skill — surfaces `draft_application_outline`, `add_to_coop_calendar`, `request_member_input` as callable actions). Demo arc fully working end-to-end at this point.
- By Sat EOD: migrate as many of the 10 back-half skills as land cleanly. If 3 or more are not migrated by 8pm Sat, stop the migration there and freeze the rest on the existing JSON-schema path. Document in commit message and ARCHITECTURE.md.
- Lazy-load (`import()` at use site) `@coop/shared/modules/erc8004`, `fvm`, `stealth`, `privacy`, `archive`, `policy`, and `greengoods` operator rails from any code reachable in simple mode. Keep them functional in advanced mode and in tests.
- Measure bundle size before and after with `cd packages/extension && bun run build` and inspect `.output/chrome-mv3/`. Report deltas in the commit message.
- Tighten the Chickens compact card and Roost focus view: every visible element must be one of {what it is, why it matters, when it's due, what to do next, fit score, an attached image thumbnail, an audio note duration pill}. Remove agent-telemetry leaks. Reuse `popup-icon-button`, `panel-card`, `state-pill` from `global.css`.
- Commit checkpoint: full demo path walks on a real device with image + audio + text inputs; bundle size measurably down; no advanced terms visible.
- Escalation: bundle reduction <20% OR demo-path skills not all migrated by Sat noon → stop and tell me.

DAY 3 (Sun May 17) — Record, write, freeze
- Run the demo end-to-end as a dry run. Fix any drift in copy, timing, or render order. Time the run — target 75 seconds, hard ceiling 90.
- Record a 60–90s screen capture. Use Loom or QuickTime. Hit the chicken-or-egg hook in the first 7 seconds. Show the model loading from local cache on the second run to prove offline capability. Show one function call (`draft_application_outline`) firing on camera.
- Write the `README.md` submission section (300–500 words): one-line product description, demo arc beats, Gemma 4 details (model ID, quantization, runtime), climate/resilience framing, local-first claims, video link, run instructions.
- Write `ARCHITECTURE.md` (1,500–2,500 words). Structure:
  1. The problem: scattered knowledge → community opportunity, on-device, low-bandwidth.
  2. The product loop: capture → refine → review → share, mapped to Coop's chicken metaphor.
  3. Gemma 4 integration: provider abstraction, multimodal worker, function-calling skill surface, why E2B/E4B was chosen, how the Qwen fallback works for non-WebGPU.
  4. Local-first architecture: Dexie + Yjs + y-webrtc/y-websocket, what stays local, what syncs, when.
  5. Simple-mode and advanced-mode: the `uiMode` preference, what's hidden, why.
  6. Lazy-loaded modules and bundle strategy.
  7. What we'd build next: function-calling for remaining skills, vision-based PDF parsing, multilingual support.
  Cite the Kaggle hackathon focus areas. Link to relevant Hugging Face model cards.
- Run `bun run validate smoke` and `bun run validate:store-readiness`. Both must be green before freeze.
- Stop after these pass. Mon May 18 is submission day, not development day.

MON MAY 18 — Submit
- Confirm the Kaggle submission form, paste the repo link, paste the video link, paste the ~200-word entry description, attach the README write-up. Then stop.

LITERAL COPY (do not paraphrase)
- Empty state and hero (no coop yet): `Chicken or egg? Neither — you need a coop first.`
- Primary CTA below it: `Launch the Coop`
- Once a coop exists, the existing `Round up your loose chickens` line returns for the loose-tab/capture empty state. The chicken-or-egg line only renders *before* a coop exists.

WORKING PRINCIPLES
- Simpler beats more. Less code beats more code. Reuse what exists in `packages/extension/src/views/shared/` and `global.css`. See `CLAUDE.md` for the canonical reuse list.
- DRY — three near-duplicates become one. KISS — if a component does two unrelated things, split it. YAGNI — do not build for features outside the demo arc.
- Never narrate complexity to the user. The product hides it; the code hides it behind clean module boundaries.
- Brand voice: warm, playful, chicken-flavored, never cute-by-accident. Rooster Call on success, soft tones on errors.
- Verify before claiming done: render the UI in a real Chrome session and walk the demo path. Type checks and unit tests are necessary, not sufficient.

SCOPE-CUT PRIORITY (apply autonomously if a day's work spills)
Never cut, in order of sanctity: the chicken-or-egg hook copy → on-device Gemma 4 inference → the recorded 60–90s video → simple-mode default → the demo arc end-to-end.
First cuts, in order: full function-call migration of back-half skills (drop to demo-path-only with JSON-schema fallback) → audio modality (keep image + text only, mention audio as roadmap) → ARCHITECTURE.md depth (aim 1,500 words instead of 2,500) → E4B variant work (E2B alone, no E4B comparison) → lazy-loading scope (keep five modules instead of seven).
If two cuts hit by Sat EOD, escalate.

OUT OF SCOPE (do not touch)
- No deletions. No removed modules.
- No new dependencies beyond bumping `@huggingface/transformers` if `Gemma4ForConditionalGeneration`, `load_image`, or `read_audio` are missing at the pinned version. Commit that bump separately.
- No edits to `packages/shared/src/contracts/`, `policy/action-payload-parsers.ts`, `permit/`, `session/`, `onchain/`, `archive/` beyond making them lazy-loaded.
- No changes to `packages/api/` (signaling/Yjs server).
- No new feature flags, env vars, or build modes beyond `uiMode: 'simple' | 'advanced'`.
- No deep popup redesign — only hide advanced bleed and swap empty-state copy.
- The "Attach photo" / "Attach voice memo" affordance is for the demo only; it lives in a minimal surface beside existing capture controls. Do not redesign capture broadly.

VERIFICATION RITUAL (run before every commit)
1. `bun run validate quick` (typecheck + lint). Must be green.
2. Targeted tests for any file touched: `bun run test -- <path>`.
3. If popup or sidepanel UI changed: `cd packages/extension && bun run build` and reload the unpacked extension; screenshot the changed surface.
4. If `models.ts`, `provider-contracts.ts`, or any inference worker changed: run `opportunity-extractor` against a real grants page in a real Chrome session with image + audio inputs and confirm a structured brief lands in Chickens.
5. If a skill migrated to function calling: run that skill's targeted test AND a smoke run through `runner-skills.ts` to confirm tool-call parsing works.

DAILY ESCALATION TRIGGERS (stop and ask me)
- Day 1 EOD: Gemma 4 fails to load on-device, OR multimodal (image OR audio) cannot round-trip, OR `opportunity-extractor` cannot produce a valid function-call output.
- Day 2 NOON: demo-path skills (opportunity-extractor, grant-fit-scorer, tab-router, theme-clusterer, review-digest, grant-action-planner) are not all migrated.
- Day 2 EOD: bundle reduction <20%, OR two scope cuts have hit, OR the end-to-end demo path is not walking on a real device.
- Day 3 NOON: demo dry run does not walk cleanly, OR ARCHITECTURE.md is not at least 1,000 words.

DONE LOOKS LIKE
- Branch `feature/hackathon-simplify` is pushed.
- `bun run validate smoke` and `bun run validate:store-readiness` green on the branch.
- A 60–90s video exists at a URL I can paste into Kaggle, showing the chicken-or-egg hook in the first 7s and image + audio + text inputs producing an on-device Gemma 4 brief.
- README has the submission section (300–500 words). ARCHITECTURE.md exists (≥1,500 words).
- Hook copy lands as the literal string above; old "loose chickens" string only appears once a coop exists.
- Gemma 4 is the live model (E2B default, E4B if it loaded fast and improved quality); Qwen path retained as fallback.
- Demo-path skills run via function calling; back-half skills are either migrated or explicitly marked Gemma 4-ready / JSON-schema fallback in ARCHITECTURE.md.
- I open the popup, see the hook, walk the garden-grants arc with image + audio + text inputs, see a real on-device Gemma 4 brief, watch one function call fire, and push to a coop.

START NOW WITH DAY 1.
```

## Notes for the user

- **Hackathon confirmed**: The Gemma 4 Good Hackathon on Kaggle, partnered with Google DeepMind. $200K prize pool. Submission deadline **Mon May 18, 2026**. Focus areas: health, education, climate, global resilience. Garden grants for community gardens fits cleanly in the climate / resilience track.
- **Gemma 4 confirmed** (released April 2, 2026):
  - Variants: **E2B** (~2B effective params), **E4B** (~4B effective params), **26B A4B** (MoE, 4B active), **31B** dense. Browser path covers E2B and E4B.
  - **HF model IDs for the swap**: `onnx-community/gemma-4-E2B-it-ONNX` (default), `onnx-community/gemma-4-E4B-it-ONNX` (fallback if it loads fast on your hardware).
  - `q4f16` quantization, `webgpu` device, 128k context window, native system role, multimodal (text/image/audio in).
  - **transformers.js** is the live runtime; **MLC WebLLM** does not yet support Gemma 4 (issue #810).
- **Submission scope** (chosen by you, ambitious for 3 days):
  - Full multimodal demo: image (grant site screenshot), audio (community meeting clip), text (tab metadata).
  - Function calling across all 16 agent skills (demo-path-first, back-half best-effort).
  - README submission section + ARCHITECTURE.md (1,500–2,500 words).
- **Scope-cut priority is baked into the prompt** so the goal-mode agent can self-resolve when something slips. First cuts are the back-half function-call migration, then audio modality, then ARCHITECTURE.md depth, then E4B work. The chicken-or-egg hook, on-device Gemma 4, the demo arc, simple-mode default, and the video are never cut.
- **What you should test in the next 30 minutes**: open `https://huggingface.co/spaces/webml-community/Gemma-4-WebGPU` in Chrome on your Mac, try both E2B and E4B. Note load times. The goal-mode agent will repeat this on Day 1 but a manual sanity check de-risks the whole sprint.
- **Demo recording**: block 2–3 hours Sun afternoon. Voice memo and screenshot prep matters — line up one PDF-heavy grant page and a short voice clip in advance.
- **Branch**: `feature/hackathon-simplify` — goal-mode agent cuts it from `main` on first run.

Sources:
- [Gemma 4 — Google DeepMind announcement](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)
- [Welcome Gemma 4: Frontier multimodal intelligence on device (Hugging Face)](https://huggingface.co/blog/gemma4)
- [onnx-community/gemma-4-E2B-it-ONNX (Hugging Face model card)](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX)
- [Gemma 4 WebGPU demo (Hugging Face Space)](https://huggingface.co/spaces/webml-community/Gemma-4-WebGPU)
- [The Gemma 4 Good Hackathon (Kaggle)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
- [Kaggle launch tweet — $200K, May 18 2026 deadline](https://x.com/kaggle/status/2039740198259462370)
- [Gemma 4 browser extension reference (nico-martin)](https://github.com/nico-martin/gemma4-browser-extension)
- [WebLLM Gemma 4 support request (issue #810)](https://github.com/mlc-ai/web-llm/issues/810)
