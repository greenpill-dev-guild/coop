# Closing section — quick polish

## Context

The landing's closing today is two beats:

1. **Arrival scene** ([ArrivalJourneySection.tsx](packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx)) — night-sky parallax with chickens flying into the lit coop, plus the **"Why we're building Coop"** card top-left. The team card was just removed.
2. **Footer** ([Landing/index.tsx](packages/app/src/views/Landing/index.tsx:818)) — copyright + 3 plain links (GitHub, Docs, Bluesky).

It reads atmospheric but flat: after a visitor finishes the narrative, there is no closing action, no credibility cue, and the footer is barely a footer.

User direction (from clarifying questions):
- **Goal**: All three lightly — one closing action + a touch of credibility + still feel like a clean narrative close.
- **Budget**: Tiny (≤30 min). No new section, no new big copy, minimal i18n.

## Recommended changes

Three small adds, all inside files already touched on this branch. No new components, no new sections, no new dependencies.

### 1. One closing CTA inside the arrival scene

Below `.why-build-heading-card` in [ArrivalJourneySection.tsx](packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx:115), add a single primary CTA that loops the visitor back to the ritual. Anchor `href="#ritual"` reuses the smooth-scroll the hero already uses.

```jsx
<div className="why-build-heading-card">
  <h2>{t('why_build.heading')}</h2>
  <p className="lede">{t('why_build.description')}</p>
  <a className="button button-primary why-build-cta" href="#ritual">
    {t('why_build.ctaLabel')}
  </a>
</div>
```

Copy (single key add in [translations.json](packages/app/src/i18n/translations.json) under `why_build`):
- `why_build.ctaLabel`: `Start shaping your coop` (en). Mirror in pt/es/zh/fr with existing translations style.

Why it works: gives the closing a job (loop back to the action), reuses existing CSS button tokens, no new layout.

### 2. Footer credibility line + small wordmark/tagline

Replace the bare `.landing-footer-inner` in [Landing/index.tsx:818-836](packages/app/src/views/Landing/index.tsx:818) with:

```jsx
<div className="landing-footer-inner">
  <div className="landing-footer-brand">
    <span className="footer-copy">&copy; {new Date().getFullYear()} Greenpill Dev Guild</span>
    <span className="landing-footer-credibility">
      {t('footer.credibility')}
    </span>
  </div>
  <nav className="footer-links-row" aria-label={t('footer.linksLabel')}>
    {/* same 3 links */}
  </nav>
</div>
```

Copy (two key adds under a new `footer` namespace):
- `footer.credibility`: `Open source · Built for the Gemma 4 Good Hackathon`
- `footer.linksLabel`: `Resources` (a11y label only)

Why it works: gives the footer two distinct columns — brand+credibility on the left, resources on the right — without adding a new visual section. The "Gemma 4 Good Hackathon" line is the credibility cue the user said is currently missing.

### 3. CSS polish — minimal

Add to [styles.css](packages/app/src/styles.css), no rewrites:

```css
.why-build-cta {
  margin-top: 0.6rem;
  align-self: start;
  min-height: 2.55rem;
  padding: 0.62rem 1.05rem;
  font-size: 0.92rem;
}

.landing-footer-brand {
  display: grid;
  gap: 0.2rem;
}

.landing-footer-credibility {
  font-size: 0.78rem;
  color: rgba(79, 46, 31, 0.6);
}
```

Existing `.landing-footer-inner` and `.footer-links-row` flexbox already lay the two columns side-by-side, so no layout overhaul.

## Files to modify

| File | Change |
|------|--------|
| [packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx](packages/app/src/views/Landing/sections/ArrivalJourneySection.tsx) | Add the CTA `<a>` inside `.why-build-heading-card` |
| [packages/app/src/views/Landing/index.tsx](packages/app/src/views/Landing/index.tsx) | Restructure footer inner to two-column brand + links |
| [packages/app/src/i18n/translations.json](packages/app/src/i18n/translations.json) | Add `why_build.ctaLabel`, `footer.credibility`, `footer.linksLabel` (5 locales) |
| [packages/app/src/styles.css](packages/app/src/styles.css) | Add `.why-build-cta`, `.landing-footer-brand`, `.landing-footer-credibility` |

Out of scope (explicitly): new section above the footer, demo video embed, email capture, social proof testimonials, team grid, hackathon logo art, additional CTAs, footer link reorganization beyond the credibility line.

## Verification

Server is already running at port 3001 ([.claude/launch.json](.claude/launch.json)). After the edits:

1. `preview_eval` → `window.location.reload()` to pick up changes.
2. Scroll to bottom (`window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'})`).
3. `preview_screenshot` at 1280×800 desktop and 375×812 mobile — confirm:
   - Closing CTA visible under why-build heading card; hovering shows brand button styling
   - Footer reads: brand+copyright+credibility on left, GitHub/Docs/Bluesky on right
   - No horizontal scroll, no layout shifts vs. baseline
4. `preview_click` on `.why-build-cta` — confirm hash becomes `#ritual` and page scrolls back.
5. Run `bun run validate quick` to confirm typecheck + lint pass on the four touched files.
