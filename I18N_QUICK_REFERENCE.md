# Coop Landing Page i18n - Quick Reference & Visual Summary

## TL;DR: i18n Decision

**Framework:** i18next + react-i18next  
**Languages:** en, pt-BR, es, zh-CN, fr  
**Bundle Impact:** +3KB (framework) + ~25KB (all translations)  
**Time to Implement:** 3-4 weeks  
**Complexity:** Low-Medium

---

## Text Inventory Overview

```
┌─────────────────────────────────────────────────────────┐
│         TOTAL TRANSLATABLE STRINGS: ~120-130            │
├─────────────────────────────────────────────────────────┤
│  Chicken Labels (12)          ████░░░░░░░░░░░░░░░░ 10%  │
│  Chicken Thoughts (24)        ████████░░░░░░░░░░░░ 20%  │
│  Hero Content (8)             ███░░░░░░░░░░░░░░░░░  7%   │
│  How It Works (8)             ███░░░░░░░░░░░░░░░░░  7%   │
│  Audience Options (8)         ███░░░░░░░░░░░░░░░░░  7%   │
│  Ritual Cards (16+)           ██████░░░░░░░░░░░░░░ 14%  │
│  System/Error Messages (15)   ██████░░░░░░░░░░░░░░ 13%  │
│  UI Elements (20+)            ████████░░░░░░░░░░░░ 17%  │
│  Miscellaneous               ██░░░░░░░░░░░░░░░░░░░  5%   │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure at a Glance

```
packages/app/src/
├── i18n/
│   ├── config.ts                      # Initialize i18next
│   ├── lang-detector.ts               # URL > localStorage > browser lang
│   ├── types.ts                       # TypeScript key definitions
│   └── translations/
│       ├── en/
│       │   ├── common.json            # UI chrome (5 languages)
│       │   ├── landing.json           # Hero, cards, chickens
│       │   ├── ritual.json            # Ritual card fields
│       │   └── errors.json            # Error messages
│       ├── pt-BR/  ↓ same 4 files
│       ├── es/     ↓
│       ├── zh-CN/  ↓
│       └── fr/     ↓
├── components/
│   └── LanguageSwitcher.tsx           # <select> for language choice
├── views/Landing/
│   └── index.tsx                      # Refactored to use useTranslation()
└── __tests__/
    └── landing.i18n.test.tsx          # Unit + E2E tests
```

---

## Language Persistence Logic Flow

```
┌─────────────────────────────────────────────────────────┐
│  User visits or returns to landing page                 │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Check URL?     │
         │ ?lang=pt-BR    │
         └───────┬────────┘
                 │
         ┌──────NO──────┐  ┌──────YES──────┐
         │              │  │                │
    ┌────▼────┐   ┌─────▼──────┐   ┌──────▼────┐
    │Check    │   │Set lang to │   │Use URL    │
    │localStorage│  │URL param  │   │language   │
    └────┬────┘   │Save to LS  │   └──────┬────┘
         │        └─────────────┘          │
   ┌─────▼─────┐                  ┌───────▼─────┐
   │Found? YES │                  │Update URL   │
   │     NO    │                  │bar quietly  │
   └─────┬─────┘                  └───────┬─────┘
         │                                │
    ┌────▼─────┐                  ┌──────▼─────┐
    │Check     │                  │             │
    │navigator │                  │ ✓ Ready to  │
    │.language │                  │   render    │
    └────┬─────┘                  └─────────────┘
         │
    ┌────▼─────┐
    │Match 'pt' │
    │ to 'pt-BR'│
    └────┬─────┘
         │
    ┌────▼──────────┐
    │Default to 'en'│
    └────┬──────────┘
         │
    ┌────▼─────┐
    │ ✓ Ready  │
    │ to render│
    └──────────┘
```

---

## Language Selector Placement

### Option A: Header (Recommended)
```
┌──────────────────────────────────────────────────┐
│  Coop                              [Language ▼]  │  ← LanguageSwitcher
├──────────────────────────────────────────────────┤
│                                                  │
│    Your data stays yours                         │
│    (rest of landing page)                        │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Option B: Footer
```
┌──────────────────────────────────────────────────┐
│                                                  │
│    Your data stays yours                         │
│    (rest of landing page)                        │
│                                                  │
├──────────────────────────────────────────────────┤
│ Privacy  |  Docs  |  GitHub  | [Language ▼]     │
└──────────────────────────────────────────────────┘
```

**Recommendation:** Header (better discoverability for international users)

---

## Code Integration Points

### Before (All strings in data file)
```typescript
// landing-data.ts
export const journeyChickens = [
  { id: 'tabs', label: 'Tabs' },  // Hardcoded English
  { id: 'notes', label: 'Notes' },
];

// Components reference directly
<span>{chicken.label}</span>
```

### After (Strings in i18n JSON, components use hooks)
```typescript
// landing-data.ts
export const journeyChickenIds = ['tabs', 'notes'];  // IDs only

// Component
function ChickenLabel({ id }) {
  const { t } = useTranslation('landing');
  return <span>{t(`chicken.${id}`)}</span>;  // Dynamic lookup
}
```

---

## Translation JSON Structure Example

### English (en/landing.json)
```json
{
  "chicken": {
    "tabs": "Tabs",
    "notes": "Notes"
  },
  "hero": {
    "callClip": "Call clip",
    "callClipText": "Save the key moment before it drifts."
  },
  "howItWorks": {
    "title1": "Your data stays yours",
    "detail1": "Everything you capture stays on your device..."
  }
}
```

### Portuguese (pt-BR/landing.json)
```json
{
  "chicken": {
    "tabs": "Abas",
    "notes": "Anotações"
  },
  "hero": {
    "callClip": "Trecho de chamada",
    "callClipText": "Capture o momento-chave antes que se disperse."
  },
  "howItWorks": {
    "title1": "Seus dados continuam sendo seus",
    "detail1": "Tudo que você captura fica no seu dispositivo..."
  }
}
```

---

## Language Switching (No Reload)

```typescript
// LanguageSwitcher.tsx
const handleLanguageChange = (lang) => {
  // 1. Update i18next
  i18n.changeLanguage(lang);  // All components re-render with new strings
  
  // 2. Persist choice
  localStorage.setItem('coop-landing-language', lang);
  
  // 3. Update URL
  const url = new URL(window.location);
  url.searchParams.set('lang', lang);
  window.history.replaceState({}, '', url.toString());
};

// Result: Page updates instantly, no reload needed ✓
```

---

## Bundle Impact Analysis

```
Current Landing Page:
├── React + DOM                  ~45 KB
├── GSAP animations              ~35 KB
├── Landing component + CSS      ~20 KB
└── Total (gzipped)             ~100 KB

With i18n (rough estimates):
├── i18next library              +3 KB
├── react-i18next                +2 KB
├── EN strings (common.json)      +2 KB
├── PT strings (pt-BR.json)       +2 KB
├── ES strings (es.json)          +2 KB
├── ZH strings (zh-CN.json)       +3 KB  (longer text)
├── FR strings (fr.json)          +2 KB
└── Additional overhead           +1 KB
                                 ─────
                            Total +17 KB

Final size (gzipped):            ~117 KB

Performance Impact: Acceptable (<20% increase)
```

---

## Challenging Translations Table

| English | PT-BR | ES | ZH-CN | FR | Difficulty |
|---------|-------|----|----|----|----|
| "Loose thread" | Conversa incompleta | Hilo suelto | 未完成的讨论 | Fil rouge | HIGH |
| "drift" | dispersar | dispersarse | 消失 | s'efface | HIGH |
| "Member energy" | Energia dos membros | Energía del grupo | 成员的状态 | Énergie du groupe | MEDIUM |
| "proof that lasts" | Prova que perdura | Prueba que perdura | 持久的证明 | Preuve qui dure | MEDIUM |

**Key Issue:** English uses metaphors; translations need cultural adaptation.

---

## Implementation Timeline

```
Week 1: Setup & Extraction
├─ Mon: Create file structure
├─ Tue: Write config.ts, lang-detector.ts
├─ Wed: Build all 5 × 4 JSON files (20 files)
├─ Thu: TypeScript types, LanguageSwitcher component
└─ Fri: Integration smoke test

Week 2: Framework Integration
├─ Mon: Update Landing component to use hooks
├─ Tue: Test language switching
├─ Wed: URL persistence, localStorage
├─ Thu: Performance profiling
└─ Fri: Internal QA

Week 3: Translation Handoff
├─ Mon: Professional translator review (major fixes)
├─ Tue: Community translator for nuance
├─ Wed: Crowdin/i18nexus setup (optional)
├─ Thu: Translation validation CI/CD
└─ Fri: Language-specific QA

Week 4: Launch
├─ Mon: Speech recognition testing in all languages
├─ Tue: E2E tests (Playwright)
├─ Wed: Lighthouse performance check
├─ Thu: Production build validation
└─ Fri: Deploy & monitor analytics

Total: 20 working days (realistic for 1-2 engineers)
```

---

## Dependency Checklist

### To Add (2 packages)
```bash
npm install i18next@^23.7.0
npm install react-i18next@^14.0.0
npm install --save-dev i18next-parser@^8.12.0  # Optional: CLI extraction
```

### No Breaking Changes
- React 19 compatible
- Vite builds without modification
- Works with existing CSS/styling
- Type-safe with TypeScript 5.8+

---

## Testing Strategy Overview

### Unit Tests
```
✓ Language persistence (URL → localStorage → browser)
✓ Dynamic switching (no reload)
✓ Fallback to English for missing keys
✓ All 5 languages render correctly
✓ TypeScript key autocomplete
```

### E2E Tests (Playwright)
```
✓ Visit landing with ?lang=pt-BR
✓ Verify Portuguese content
✓ Switch to Spanish via dropdown
✓ Reload page, Spanish persists
✓ Check hero content, How It Works, ritual cards
✓ Test speech recognition in Mandarin
✓ Performance metrics < 1s first paint
```

### Performance Tests
```
✓ Bundle size within +20%
✓ Language switch < 100ms
✓ No layout shift on language change
✓ Lighthouse score remains 90+
✓ Mobile performance impact minimal
```

---

## Configuration: Environment Variables

```bash
# .env.local (add these)
VITE_COOP_DEFAULT_LANGUAGE=en
VITE_COOP_SUPPORTED_LANGUAGES=en,pt-BR,es,zh-CN,fr
VITE_COOP_ENABLE_LANGUAGE_SWITCHER=true
VITE_COOP_FALLBACK_LANGUAGE=en
```

---

## Sample Component Usage

### Before (No i18n)
```typescript
function HowItWorks() {
  return (
    <section>
      <h2>Your data stays yours</h2>
      <p>Everything you capture stays on your device...</p>
    </section>
  );
}
```

### After (With i18n)
```typescript
function HowItWorks() {
  const { t } = useTranslation('landing');
  
  return (
    <section>
      <h2>{t('howItWorks.title1')}</h2>
      <p>{t('howItWorks.detail1')}</p>
    </section>
  );
}
```

---

## Monitoring & Analytics

### Recommended Tracking
```typescript
// Segment / Mixpanel
analytics.track('Language Changed', {
  from: currentLanguage,
  to: selectedLanguage,
  method: 'dropdown' | 'url' | 'auto-detect',
  timestamp: Date.now(),
});

analytics.identify(userId, {
  preferredLanguage: selectedLanguage,
  isInternational: selectedLanguage !== 'en',
});
```

### Alerts to Set Up
- Missing translation keys in production
- Translation completeness < 95%
- Language switch latency > 200ms
- Bundle size increase > 25%

---

## Troubleshooting Guide

### Issue: Language doesn't persist after reload
**Cause:** localStorage not saved or URL param ignored  
**Fix:** Check `lang-detector.ts` priority order, verify localStorage write

### Issue: Strings showing as `chicken.tabs` instead of "Tabs"
**Cause:** Translation key not found in JSON  
**Fix:** Verify JSON structure matches component code, check namespaces

### Issue: Performance degradation after adding i18n
**Cause:** Loading all language files at once  
**Fix:** Implement code splitting per language, lazy load non-active

### Issue: Chinese characters display incorrectly
**Cause:** Font not supporting Mandarin, encoding issue  
**Fix:** Use system fonts or add Noto Sans CJK, verify UTF-8 encoding

---

## Phased Rollout Strategy

### Phase 1 (Week 1-2): Internal Only
- Deploy to staging with all languages
- Team tests in their native languages
- Gather feedback on translations

### Phase 2 (Week 3): Beta Group
- Release to 10% of users (cookie-based)
- Monitor for language-specific issues
- Collect analytics on language preferences

### Phase 3 (Week 4): Full Launch
- Roll out to 100% of users
- Monitor performance metrics
- Set up automated translation updates

---

## Future Expansion

### Adding More Languages
```typescript
// Simply add new JSON files:
src/i18n/translations/
  └── ja/ (Japanese)
      ├── common.json
      ├── landing.json
      ├── ritual.json
      └── errors.json

// Update config.ts with new namespace
// Update LANGUAGES array in LanguageSwitcher.tsx
// Deploy - no code changes needed!
```

### Crowdin Integration
```yaml
# crowdin.yml
files:
  - source: src/i18n/translations/en/**/*.json
    translation: src/i18n/translations/%two_letters_code%/**/%original_file_name%
```

---

## Success Metrics

**Technical:**
- [ ] 100% text coverage (all strings extracted)
- [ ] <3KB additional framework bundle
- [ ] <100ms language switch latency
- [ ] 95%+ translation completeness
- [ ] Zero console errors per language

**User:**
- [ ] 5%+ international traffic increase
- [ ] Language preference analytics tracked
- [ ] <2% bounce rate change
- [ ] Positive feedback on translations
- [ ] 90+ Lighthouse score maintained

---

## Key Takeaways

1. **i18next is the right choice** - Battle-tested, scalable, type-safe
2. **URL+localStorage persistence** - Shareable links + cross-device memory
3. **120-130 strings to translate** - Manageable scope
4. **Minimal bundle impact** - ~17KB for all 5 languages
5. **3-4 weeks to launch** - Realistic with 1-2 engineers
6. **Challenging phrases exist** - But all have good solutions
7. **Testing is critical** - Unit + E2E + language-specific QA
8. **Plan for expansion** - Structure supports 50+ languages

---

**For detailed implementation**, see: **I18N_SETUP_GUIDE.md**
