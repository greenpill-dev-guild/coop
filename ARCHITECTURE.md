# Coop — Architecture

Coop is a browser-first, local-first knowledge coordination tool for community
groups working on climate adaptation, mutual aid, and other low-bandwidth,
high-stakes coordination problems. The interesting architectural choices live
at the intersection of three constraints: keep everything on-device by default,
let groups review before sharing, and use the strongest small multimodal model
that will run in a Chrome MV3 extension on a modest laptop.

This document covers the choices that matter for **The Gemma 4 Good Hackathon**
submission. It is written to be read in order; each section grounds the next.

## 1. The problem

Community gardens, mutual aid networks, and bioregional coalitions live with a
recurring failure mode: the people doing the work spend most of their attention
on the work itself, not on noticing and circulating opportunities. A grant
window opens. Someone bookmarks the page. The deadline passes before the group
ever talks about it. A member voices a need at a meeting. Nobody captures it.
A photo of an awkward grant-site PDF sits in someone's camera roll and never
gets transcribed.

The classic solution — push everyone into a shared SaaS — fails this audience
twice. First, low-bandwidth communities cannot rely on always-on cloud round
trips. Second, communities working on contested ground (land, funding,
identity) need their captured material to stay local until the group decides
what to share. A solution that requires uploading the raw signal to be useful
loses the trust contest before it starts.

Coop's bet: the moment of capture, the moment of synthesis, and the moment of
review all happen on-device. Sharing happens last, and only when a member
explicitly says so.

## 2. The product loop

Coop's product surface follows a four-step loop, named through the chicken
metaphor that runs through the brand:

1. **Capture** — Browser tabs (extension), audio + photos + files (companion
   PWA). Captures land in the user's local **Loose Chickens** queue.
2. **Refine** — An on-device agent harness runs sixteen skills against new
   captures: extracting opportunities, scoring fit, clustering themes,
   drafting reviews. The capture surfaces in the **Roost** for human review.
3. **Review** — The user opens the Chickens tab, looks at the agent's
   suggestion (the brief, the score, the proposed next action), and either
   pushes it forward to a coop or dismisses it.
4. **Share** — Approved drafts publish to a shared coop. Members see the same
   feed via Yjs sync; production deployments anchor the coop to a Safe
   multisig on Arbitrum and (optionally) archive to Filecoin via Storacha.

The hackathon demo arc is this loop end-to-end with a multimodal twist: a
fresh user launches a coop, captures grant tabs (text), attaches a screenshot
of a PDF-heavy grant site (image), records a 15-second voice memo from a
meeting (audio), and watches Gemma 4 produce a structured opportunity brief on
the device — including one function-call moment that drafts the application
outline.

## 3. Gemma 4 integration

Gemma 4 lives behind Coop's existing **agent provider** abstraction so the
fallback story stays clean.

### Provider abstraction

The runtime declares a small set of providers, each registered via a
`AgentRuntimeProviderContract`:

- `heuristic` (p0) — deterministic, no model, used as the safety net.
- `transformers` (p1) — Qwen 2.5 0.5B via transformers.js on WASM.
- `webllm` (p2) — Qwen 2 0.5B via @mlc-ai/web-llm on WebGPU.
- `gemma4` (p2) — **the new one** — Gemma 4 E2B (or E4B as a quality fallback)
  via transformers.js on WebGPU.
- `chrome-prompt-api` (p3) — Gemini Nano via the Chrome built-in API; staged.

Each contract declares capability flags (`supportsMultimodal`,
`requiresWebGpu`, `structuredJson`) and a `fallbackOrder`. The provider
contract for `gemma4` lists `webllm → transformers → heuristic` as fallbacks,
so a hardware mismatch or a load failure degrades cleanly to a smaller
text-only model without the runner having to know.

### The bridge and the worker

`AgentGemma4Bridge` (in `packages/extension/src/runtime/agent/gemma4-bridge.ts`)
owns a dedicated MV3 web worker (`agent-gemma4-worker.js`). The worker boots
once per session, prewarms when a relevant skill is registered, and idles out
after fifteen minutes. The bridge accepts a request shape that already
recognizes the three Gemma 4 modalities:

```ts
type Gemma4Request = {
  system?: string;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  audioSamplingRate?: number;
  tools?: Gemma4ToolDefinition[];
  forceToolName?: string;
  maxTokens?: number;
};
```

Inside the worker, the loader follows the canonical transformers.js v4 path:

```js
const processor = await AutoProcessor.from_pretrained(model_id);
const model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, {
  dtype: 'q4f16',
  device: 'webgpu',
});
const image = imageUrl ? await load_image(imageUrl) : null;
const audio = audioUrl ? await read_audio(audioUrl, 16000) : null;
const promptText = processor.apply_chat_template(messages, {
  add_generation_prompt: true,
  tokenize: false,
  tools, // <-- function-calling tool schema
});
const inputs = await processor(promptText, image, audio);
const outputs = await model.generate({ ...inputs, max_new_tokens });
```

`load_image` and `read_audio` are the points where the demo's image and audio
inputs become tensors the model understands. The worker discards the
`input_ids` prefix on decode so only the assistant's response surfaces back
across the postMessage boundary.

### Function calling

Gemma 4's chat template renders any `tools` array as part of the system
prompt and trains the model to emit `<tool_call>{...}</tool_call>` payloads.
Coop ships hand-rolled JSON Schemas for the demo-path skills:

- `extract_opportunity` (opportunity-extractor)
- `score_grant_fit` (grant-fit-scorer)
- `route_tab` (tab-router)
- `cluster_themes` (theme-clusterer)
- `review_digest` (review-digest)
- `draft_application_outline` (grant-action-planner — the on-camera moment)

The bridge parses the `<tool_call>` markers, validates the parsed
`arguments` against the matching `SkillOutputSchemaRef` Zod schema, and the
runner sees the same shape it would have seen from the legacy JSON-text
path. `validateSkillOutput` is preserved as a type guard at the boundary —
the function-calling story is additive, not a replacement.

When the model picks a different tool than the one the runner expected, the
bridge filters the call back out and falls through to the JSON-text repair
path. That keeps the back-half skills (10 of 16) functional on Gemma 4
without forcing them through tool calling on a Saturday-noon deadline.

### Why E2B by default

The brief's working hypothesis was that a 2B-parameter model would be the
right balance between capability and cold-start time on a typical demo
laptop. The bridge exposes `setModelVariant('E4B')` to flip to the larger
variant; `getQualityGemma4ModelId()` returns the E4B model id. The
provider's `defaultModelId` reads `getGemma4ModelId()` (E2B) so dashboards
and benchmark records track the variant the user sees.

## 4. Local-first architecture

Coop persists captured material in two layers:

- **Dexie (IndexedDB)** — Structured records: drafts, observations, plans,
  benchmarks. Schemas are declared as Zod objects in
  `@coop/shared/contracts/schema*.ts` and validated at every boundary.
- **Yjs (CRDT)** — The coop's shared document. Each member runs a Y.Doc;
  changes propagate via `y-webrtc` (peer-to-peer) and `y-websocket`
  (server-assisted) over the same signaling channel.

The extension never crosses the wire until a member explicitly publishes.
The receiver PWA pairs to the extension over WebRTC, with HMAC-validated
sync envelopes to guarantee that only the user's own devices participate.
Archive and onchain rails (Safe + ERC-4337 + Storacha + ERC-8004) sit
behind opt-in modes (`VITE_COOP_ONCHAIN_MODE=mock|live`).

The Gemma 4 path inherits this posture for free: the model itself caches in
the browser after the first download, the worker holds it in memory until
idle, and at no point does any captured text, image, or audio leave the
device during inference. The hackathon demo's "offline second run" shows
the model loading from local cache, which is the cleanest demonstration of
the local-first claim.

## 5. Simple mode and advanced mode

A single user-facing toggle, `uiMode: 'simple' | 'advanced'`, gates which
parts of Coop's surface render. The toggle lives in coop preferences and
defaults to `simple`. Simple mode hides the Roost agent diagnostics, the
Coops onchain configuration panel, and the Nest operator/archive sections;
it is what a first-time user sees and what the hackathon demo records.

Render gates are checked at component boundaries — render gates, not feature
flags — so the gated code paths still type-check and still pass tests. The
"never cut" set in the demo arc lives entirely in simple mode: the
chicken-or-egg hook, the Launch the Coop CTA, the Chickens review surface,
the Coop feed.

## 6. Lazy-loaded modules and bundle strategy

The simple-mode bundle deliberately excludes everything reachable only from
advanced mode. Heavy domain modules — `erc8004` (agent registry),
`fvm` (Filecoin VM), `stealth` (ERC-5564 stealth addresses), `privacy`
(Semaphore ZK proofs), `archive` (Storacha lifecycle), `policy` (action
parsers), and the Green Goods operator rails — load via dynamic `import()`
boundaries from the components that gate them. Tests still hit the modules
directly, so coverage stays honest.

The transformers.js v4 bump moved the onnxruntime wasm asset out of the
transformers package; a small wxt plugin resolves it through
onnxruntime-web's own dist directory and emits it into the extension's
`assets/` so the worker can find it at the canonical path the runtime
expects.

The Gemma 4 worker entrypoint sits in `entrypoints/agent-gemma4-worker.ts`
as an unlisted script and is built into a separate chunk via the existing
`applySharedChunking` hook. The simple-mode pages don't import the worker
directly — they message the bridge, which loads the worker on first use.

## 7. What we'd build next

If we had another week:

- **Function-calling for the back-half skills.** The other ten skills
  (publish-readiness-check, memory-insight-synthesizer, the four ERC-8004
  /Green Goods coordination skills, etc.) keep the JSON-text path today;
  the schemas to flip them to native tool calls are mechanical.
- **Vision-based PDF parsing.** Many grant programs publish PDFs that are
  fundamentally screenshots. The image modality already exists; a
  `pdf_to_image` skill that pre-rasterizes pages and feeds them to the
  same `extract_opportunity` tool would close the loop on a real pain
  point.
- **Multilingual support.** Gemma 4's chat template handles non-English
  conversations natively. The product surface still ships English
  copy; routing the language picker through `t()` calls everywhere
  would unlock the receiver PWA flow for non-English groups.
- **Background promotion of demo-path skills.** The existing
  `provider-promotion` machinery promotes transformers→webllm based on
  benchmark + trace evidence. An equivalent gemma4 promotion gate would
  let the runtime keep skills on the smaller fallback until enough
  confidence accrues.

## Sources

- [Welcome Gemma 4 — Hugging Face](https://huggingface.co/blog/gemma4)
- [Gemma 4 E2B-it ONNX](https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX)
- [Gemma 4 WebGPU demo](https://huggingface.co/spaces/webml-community/Gemma-4-WebGPU)
- [The Gemma 4 Good Hackathon (Kaggle)](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
