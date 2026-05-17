---
title: WebLLM
slug: /builder/integrations/webllm
---

# WebLLM

WebLLM is one of Coop's browser-native local inference providers.

## Why Coop Uses It

WebLLM lets the product attempt richer synthesis inside the browser when the device has the right
WebGPU support. That keeps the AI story consistent with the local-first product posture while still
leaving room for Gemma, Transformers.js, and deterministic fallback paths.

## Where It Fits

WebLLM is best for:

- synthesis-heavy skill runs
- higher-value draft shaping
- contexts where the browser can afford model load and GPU use

It is not the only path. Coop uses explicit provider contracts across Gemma, WebLLM,
Transformers.js, and heuristics.

## Builder Concerns

- model size and startup cost matter
- worker placement matters for keeping the UI responsive
- capability detection should happen before promising a high-end local model path
- Chrome Web Store policy and offline behavior matter for how model and WASM assets are shipped
