# Context For Landing Closing Polish

## Existing References

- Original flat plan: `.plans/how-can-we-improve-cuddly-kahan.md`.
- Current landing implementation files listed in the original note.

## Relevant Codepaths

- `packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx`
- `packages/app/src/views/Landing/index.tsx`
- `packages/app/src/i18n/translations.json`
- `packages/app/src/styles.css`

## Constraints

- Tiny UI-only pass; no new section, dependency, API, shared state, or design token.
- Preserve existing smooth-scroll anchor behavior and translation style.
- Keep changes inside the landing surface.

## Notes For Agents

- Claude should focus on the future UI implementation and browser proof.
- Codex has no state/API/contracts work for this pack.
- Shared assumption: this migration is planning-only; landing UI remains unchanged until the UI lane runs.

## Migrated Legacy Note

The original flat plan described a tiny closing-section polish pass:

- Add a single primary CTA below `.why-build-heading-card` in `ArrivalJourneySection.tsx`:
  - class: `button button-primary why-build-cta`
  - href: `#ritual`
  - translation key: `why_build.ctaLabel`
  - English copy: `Start shaping your coop`
- Replace the bare footer inner layout in `Landing/index.tsx` with a brand/credibility group plus existing resource links:
  - `footer.credibility`: `Open source · Built for the Gemma 4 Good Hackathon`
  - `footer.linksLabel`: `Resources`
- Add only minimal CSS:
  - `.why-build-cta`
  - `.landing-footer-brand`
  - `.landing-footer-credibility`
- Keep out of scope: new section, demo video, email capture, testimonials, team grid, hackathon logo art, additional CTAs, or footer reorganization beyond the credibility line.
- Verification after implementation: bottom-of-page screenshots at desktop and mobile, click `.why-build-cta`, confirm hash/scroll to `#ritual`, and run `bun run validate quick`.
