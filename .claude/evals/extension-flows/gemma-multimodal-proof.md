# Extension Flow Eval: Gemma Multimodal Proof Boundary

**Status**: ready
**Last run**: —
**Last score**: —

## Scenario

Validate the truth boundary for Coop's Gemma 4 modality claims:

> In a real loaded extension, prove which Gemma 4 inputs reached the sandbox
> during the demo flow: text, image, and native audio. If native audio is not
> proven, record transcript-to-Gemma as the honest fallback.

## Setup

- Complete `gemma-sandbox-health.md` first.
- Start from a profile with one active `Garden Grants` coop.
- Use the local fixture pages from `capture-review-push.md` for text/tab context.
- Use an existing receiver photo capture and receiver audio capture if another
  PWA-focused agent has already created them. If not, create the captures
  manually, but do not score receiver PWA UX in this eval.

## Steps

1. Capture at least one fixture grant page through the extension popup.
2. Attach or select one screenshot/photo capture that includes visible grant-page text.
3. Attach or select one short audio capture saying:
   `Garden Grants should prioritize watershed resilience and solar coops.`
4. Trigger the Gemma-backed agent path used by the current demo arc.
5. Observe the resulting Chickens item or draft.
6. Record evidence for each modality:
   - Text/tab context: fixture title, source domain, or page content appears in the generated output.
   - Image: output references visible image/screenshot details, or runtime evidence shows `imageUrl` passed to Gemma.
   - Audio: output references the spoken audio content, or runtime evidence shows `audioUrl`/`audioSamplingRate` passed to Gemma and `read_audio(...)` completed.
7. Open extension-card errors and service-worker console if available.
8. Record whether the final proof is:
   - `text+image+native-audio`
   - `text+image+transcript-audio`
   - `text-only`
   - `blocked`

## Expected Behavior

- Text/tab context reaches Gemma-backed completion.
- Image input reaches Gemma-backed completion or the report clearly identifies image proof as missing.
- Audio proof is strict: native audio counts only with `audioUrl`/`audioSamplingRate` bridge evidence and successful sandbox audio decode/completion.
- If only the audio transcript reaches Gemma, the eval records `text+image+transcript-audio` and treats native audio as unproven.
- No submission/readme wording claims more than the evidence proves.

## Failure Conditions

- The eval records native audio proof based only on a transcript.
- Image or audio proof is inferred without output evidence or runtime bridge evidence.
- Gemma sandbox/runtime errors are ignored.
- The agent reports a passing score while any modality proof is missing or ambiguous.

## Scoring

| Score | Criteria |
|-------|----------|
| 3 | Text, image, and native audio are proven with runtime/output evidence |
| 2 | Text and image are proven; audio fallback is honestly recorded as transcript-to-Gemma |
| 1 | Only text is proven, or modality evidence is incomplete but truthfully reported |
| 0 | Runtime is blocked, or the report overclaims unproven modality support |
