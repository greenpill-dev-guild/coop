# Kaggle submission entry — ready-to-paste

For Mon May 18, 2026. Paste each block into the matching field on the
Kaggle submission form. The video URL is the only placeholder you fill in
after Sun's recording uploads.

## Repository URL

```
https://github.com/greenpill-dev-guild/coop/tree/feature/hackathon-simplify
```

## Video URL

```
<PASTE_SUN_UPLOAD_URL_HERE>
```

After Sun's recording uploads to YouTube/Loom, also drop the same URL into
`README.md` (replace the phrase "is referenced from the Kaggle submission
entry" with the real `[link](URL)`).

## Entry description (~200 words)

**Coop is a browser-first, local-first coordination tool that turns scattered
knowledge into shared community memory — built around on-device Gemma 4 for
groups working on climate adaptation with low bandwidth.**

Our submission for The Gemma 4 Good Hackathon is the **Community Garden
Grants** flow: a group launches a coop, captures three grant-page tabs (text),
and attaches a screenshot of an awkward PDF-heavy grant site (image). Gemma 4
E2B running on WebGPU inside a sandboxed MV3 iframe reads both modalities and
produces a structured opportunity brief in the Chickens review tab: title,
deadline, eligibility, fit score, and why-it-matters. One native function
call (`draft_application_outline`) fires on camera and proposes the sections
the group needs to write. The brief publishes to the coop's shared Yjs feed.

Everything runs on-device. No cloud round-trips during inference. Voice
memos transcribe locally via Whisper and feed text into the same Gemma 4
brief; native audio modality is wired through the bridge and worker but
documented as roadmap pending capture-side stamping. Six demo-path skills
use Gemma 4 native function calling; ten back-half skills keep the existing
JSON-schema fallback documented in `ARCHITECTURE.md`. Climate /
global-resilience track.

(Word count: ~195)

## Submission checklist

- [ ] Sun: video recorded, trimmed to 60–90 s, uploaded
- [ ] Sun/Mon: video URL pasted above
- [ ] Mon: video URL also pasted into `README.md` §"Submission"
- [ ] Mon: README change committed and pushed
- [ ] Mon: Kaggle form opened, all three blocks pasted
- [ ] Mon: form submitted, confirmation captured
- [ ] Mon: final `bun run validate smoke` + `bun run validate:store-readiness`
      green after the README change
