# Coop Landing Page i18n Setup Guide

A comprehensive internationalization (i18n) plan for the Coop landing page, supporting 5 languages with best practices for React + Vite architecture.

---

## 1. i18n Framework Selection

### Recommended: **i18next** (with `react-i18next`)

**Why i18next:**
- **Industry Standard**: Most battle-tested React i18n solution with 6M+ weekly npm downloads
- **Vite-Friendly**: Zero runtime overhead, static JSON loading at build time
- **Type-Safe**: Full TypeScript support with zod schemas for translation keys
- **Developer Experience**: Hot module reloading, namespace splitting, lazy loading
- **Ecosystem**: Integrates with backend services, CDNs, translation management platforms
- **Coop Alignment**: Works with React 19, no additional runtime dependencies

**Alternative Considered (Not Recommended):**
- **i18n-js**: Minimal but less feature-rich, harder to scale
- **react-intl**: Over-engineered for a landing page, heavier bundle
- **Expo i18n**: Mobile-first, unnecessary complexity for web

### Setup Complexity vs. Benefits

| Aspect | Complexity | Benefit |
|--------|-----------|---------|
| Installation | Low (2 deps) | Full i18n ecosystem |
| Configuration | Low (~50 LOC) | Vite integration, code splitting |
| File Structure | Low (flat namespaces) | Scalable to 20+ languages |
| React Integration | Low (1 hook) | Reactive translations |
| Type Safety | Medium | Compile-time key validation |
| Translation Workflow | Medium | Backend platform ready |

---

## 2. Text Inventory from landing-data.ts

### Categories Found

#### A. Journey & Capture Types (Chicken Labels)
```
- Tabs, Notes, Ideas, Signals, Links, Drafts
- Threads, Clips, Bookmarks, Photos, Voice Memos, Receipts
```
**Count:** 12 items

#### B. Audience Options
```
- Personal (tone: "Personal focus and reflection")
- Family (tone: "Household memory and support")
- Friends (tone: "Shared momentum with trusted peers")
- Community (tone: "Collective coordination and stewardship")
```
**Count:** 4 items + 4 tones

#### C. Hero Signal Fragments
```
- Call clip: "Save the key moment before it drifts."
- Browser tab: "This grant lead is worth the follow-up."
- Field note: "Member energy is shifting this week."
- Loose thread: "Remember to reconnect this after the meeting."
```
**Count:** 4 items + 4 unique quotes

#### D. How It Works Cards (Story Cards)
```
- "Your data stays yours" + detail
- "One place for everything" + detail
- "Shared review loop" + detail
- "Proof that lasts" + detail
```
**Count:** 4 cards × 2 (title + detail) = 8 strings

#### E. Chicken Thoughts (Contextual Captions)
```
tabs: { kicker: 'Browser tab', text: 'This grant lead is worth the follow-up.' }
notes: { kicker: 'Field note', text: 'Member energy is shifting this week.' }
ideas: { kicker: 'Loose thread', text: 'Reconnect this after the meeting.' }
... (12 total)
```
**Count:** 12 items × 2 (kicker + text) = 24 strings

#### F. UI/System Text
```
- defaultTranscriptStatus
- resolveSpeechError messages (4 cases)
- statusLabel (3 cases: Ready, In progress, Not started)
```
**Count:** ~8 strings

#### G. Team & Partner Info
```
- teamMembers: ['Afolabi Aiyeloja', 'Luiz Fernando', 'Sofia Villareal']
- partnerMarks: ['Coop', 'Greenpill', 'Greenpill Dev Guild', 'ReFi DAO', 'Green Goods']
```
**Note:** Consider translating partnership names or keeping in English

#### H. Ritual Cards (From landing-types.ts)
```
- Knowledge, Capital, Governance, Impact (4 ritual names)
- Fields: Current, Pain, Improve (3 fields × 4 rituals = 12 field labels)
```
**Count:** 4 + 12 = 16 strings (check landing-types.ts for full text)

### Total Text Inventory Summary
- **Core UI**: ~40-50 strings
- **Chicken Labels & Thoughts**: 24 strings
- **Hero Content**: 8 strings
- **System/Error Messages**: 10-15 strings
- **Ritual Fields**: 16+ strings (need full audit of landing-types.ts)

**Total: 100-125 strings to translate**

---

## 3. Translation Scope

### Supported Languages

| Language | Code | Priority | Audience | RTL |
|----------|------|----------|----------|-----|
| English | `en` | Base | Global | No |
| Portuguese (Brazil) | `pt-BR` | P0 | LATAM + Portugal | No |
| Spanish | `es` | P0 | Spain, LATAM | No |
| Mandarin Chinese | `zh-CN` | P1 | Asia-Pacific | No |
| French | `fr` | P1 | France, Belgium, Canada | No |

### Exclusions (Keep in English)
- Team member names
- Partner organization names (unless official translated versions exist)
- Web3 terminology where English is standard (Safe, Arbitrum, etc.)
- Proper nouns (Coop, Greenpill)

### Complexity by Language

| Language | Complexity | Notes |
|----------|-----------|-------|
| Portuguese | Low | Close to Spanish, shared grammar patterns |
| Spanish | Low | European and Latin American variants possible |
| French | Medium | Gender agreement, plurals, formality levels |
| Mandarin | High | No plurals, measure words, context-dependent tone |

---

## 4. Implementation Plan

### 4.1 Framework Setup

**Dependencies to Add:**
```json
{
  "dependencies": {
    "i18next": "^23.7.0",
    "react-i18next": "^14.0.0"
  },
  "devDependencies": {
    "i18next-parser": "^8.12.0"
  }
}
```

**Key Configuration Points:**
- Vite plugin for dynamic imports
- HMR for dev-time translation updates
- Static extraction for build-time optimization

### 4.2 Language Persistence Strategy

**Recommended: URL-First with localStorage Fallback**

```typescript
// Priority order:
1. URL query param: /?lang=pt-BR
2. localStorage: 'coop-landing-language'
3. Browser Accept-Language header
4. Fallback: 'en'
```

**Benefits:**
- Shareable links preserve language choice
- Works across browser sessions
- SEO-friendly (URL params don't hurt with proper config)
- No server-side session dependency

**Implementation:**
```typescript
// packages/app/src/i18n/lang-detector.ts
export function detectLanguage(): string {
  // 1. Check URL
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang && SUPPORTED_LANGUAGES.includes(urlLang)) {
    localStorage.setItem('coop-landing-language', urlLang);
    return urlLang;
  }

  // 2. Check localStorage
  const stored = localStorage.getItem('coop-landing-language');
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
    return stored;
  }

  // 3. Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang)) {
    return browserLang;
  }

  // 4. Fallback
  return 'en';
}
```

### 4.3 RTL Support

**Current Scope:** Not needed (all 5 languages are LTR)

**Future Proofing:**
```css
/* packages/app/src/styles/rtl.css */
html[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

html[dir="rtl"] .panel-card {
  margin-left: 0;
  margin-right: auto;
}
```

### 4.4 Dynamic Language Switching

**Without Page Reload:**
```typescript
// packages/app/src/components/LanguageSwitcher.tsx
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('coop-landing-language', lang);
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <select 
      onChange={(e) => handleLanguageChange(e.target.value)}
      value={i18n.language}
      className="lang-selector"
    >
      <option value="en">English</option>
      <option value="pt-BR">Português (Brasil)</option>
      <option value="es">Español</option>
      <option value="zh-CN">中文 (简体)</option>
      <option value="fr">Français</option>
    </select>
  );
}
```

---

## 5. File Structure Proposal

### Directory Layout

```
packages/app/src/
├── i18n/
│   ├── config.ts                 # i18next initialization
│   ├── lang-detector.ts          # Language detection logic
│   ├── types.ts                  # TypeScript types for keys
│   └── translations/
│       ├── en/
│       │   ├── common.json       # Shared UI text
│       │   ├── landing.json      # Landing-specific
│       │   ├── ritual.json       # Ritual cards
│       │   └── errors.json       # Error messages
│       ├── pt-BR/
│       │   ├── common.json
│       │   ├── landing.json
│       │   ├── ritual.json
│       │   └── errors.json
│       ├── es/
│       ├── zh-CN/
│       └── fr/
├── views/
│   └── Landing/
│       ├── index.tsx             # Updated with i18n hooks
│       ├── landing-data.ts       # Migrate to i18n keys
│       ├── landing-animations.tsx
│       └── landing-types.ts
├── components/
│   ├── LanguageSwitcher.tsx      # NEW: Language selector
│   └── ... (existing)
└── hooks/
    └── useI18n.ts               # Optional: Custom hook
```

### File: packages/app/src/i18n/config.ts

```typescript
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translations
import commonEn from './translations/en/common.json';
import landingEn from './translations/en/landing.json';
import ritualEn from './translations/en/ritual.json';
import errorsEn from './translations/en/errors.json';

import commonPt from './translations/pt-BR/common.json';
import landingPt from './translations/pt-BR/landing.json';
import ritualPt from './translations/pt-BR/ritual.json';
import errorsPt from './translations/pt-BR/errors.json';

// ... repeat for es, zh-CN, fr

const resources = {
  en: {
    common: commonEn,
    landing: landingEn,
    ritual: ritualEn,
    errors: errorsEn,
  },
  'pt-BR': {
    common: commonPt,
    landing: landingPt,
    ritual: ritualPt,
    errors: errorsPt,
  },
  // ... repeat for other languages
};

i18next.use(initReactI18next).init({
  resources,
  defaultNS: 'common',
  ns: ['common', 'landing', 'ritual', 'errors'],
  lng: detectLanguage(),
  fallbackLng: 'en',
  
  interpolation: {
    escapeValue: false, // React handles XSS
  },
  
  react: {
    useSuspense: false, // Or use Suspense boundary
  },
});

export default i18next;
```

### File: packages/app/src/i18n/translations/en/common.json

```json
{
  "language": "Language",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français"
}
```

### File: packages/app/src/i18n/translations/en/landing.json

```json
{
  "chicken": {
    "tabs": "Tabs",
    "notes": "Notes",
    "ideas": "Ideas",
    "signals": "Signals",
    "links": "Links",
    "drafts": "Drafts",
    "threads": "Threads",
    "clips": "Clips",
    "bookmarks": "Bookmarks",
    "photos": "Photos",
    "voiceMemos": "Voice Memos",
    "receipts": "Receipts"
  },
  "audience": {
    "personal": "Personal",
    "personalTone": "Personal focus and reflection",
    "family": "Family",
    "familyTone": "Household memory and support",
    "friends": "Friends",
    "friendsTone": "Shared momentum with trusted peers",
    "community": "Community",
    "communityTone": "Collective coordination and stewardship"
  },
  "hero": {
    "callClip": "Call clip",
    "callClipText": "Save the key moment before it drifts.",
    "browserTab": "Browser tab",
    "browserTabText": "This grant lead is worth the follow-up.",
    "fieldNote": "Field note",
    "fieldNoteText": "Member energy is shifting this week.",
    "looseThread": "Loose thread",
    "looseThreadText": "Remember to reconnect this after the meeting."
  },
  "howItWorks": {
    "title1": "Your data stays yours",
    "detail1": "Everything you capture stays on your device until your group decides what to share.",
    "title2": "One place for everything",
    "detail2": "Tabs, notes, files, and call fragments land together before they scatter.",
    "title3": "Shared review loop",
    "detail3": "One clear queue for the group instead of hunting across chats, browsers, and memory.",
    "title4": "Proof that lasts",
    "detail4": "Progress and outcomes stay close to the work so updates are easier to revisit and trust."
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "Browser tab",
      "text": "This grant lead is worth the follow-up."
    },
    "notes": {
      "kicker": "Field note",
      "text": "Member energy is shifting this week."
    },
    "ideas": {
      "kicker": "Loose thread",
      "text": "Reconnect this after the meeting."
    },
    "signals": {
      "kicker": "Call clip",
      "text": "Save the key moment before it drifts."
    },
    "links": {
      "kicker": "Saved link",
      "text": "This keeps coming back up in conversations."
    },
    "drafts": {
      "kicker": "Draft",
      "text": "Half-finished but worth keeping close."
    },
    "threads": {
      "kicker": "Thread",
      "text": "Conversation fragments from last week."
    },
    "clips": {
      "kicker": "Clip",
      "text": "Audio moment worth revisiting."
    },
    "bookmarks": {
      "kicker": "Bookmark",
      "text": "This link keeps coming back up."
    },
    "photos": {
      "kicker": "Photo",
      "text": "Captured in the field last Tuesday."
    },
    "voiceMemos": {
      "kicker": "Voice memo",
      "text": "Quick capture from the walk home."
    },
    "receipts": {
      "kicker": "Receipt",
      "text": "Proof of the contribution last month."
    }
  }
}
```

### File: packages/app/src/i18n/translations/en/errors.json

```json
{
  "microphone": {
    "notAllowed": "Microphone or speech permissions were denied. Type notes manually for this card.",
    "audioCapture": "No microphone is available here. You can still type notes into the card.",
    "noSpeech": "No speech was detected. Try again or type notes manually.",
    "unknown": "Live transcript stopped unexpectedly. Your typed notes are still safe."
  },
  "status": {
    "ready": "Ready",
    "drafting": "In progress",
    "empty": "Not started"
  },
  "transcript": "Use live transcript if this browser supports it, or type directly into the card. Everything stays saved on this device."
}
```

### File: packages/app/src/i18n/translations/en/ritual.json

```json
{
  "knowledge": "Knowledge & Tools",
  "capital": "Money & Resources",
  "governance": "Decisions & Teamwork",
  "impact": "Impact & Progress",
  "fields": {
    "current": "What's working now?",
    "pain": "What's the pain point?",
    "improve": "How can we improve?"
  }
}
```

---

## 6. Sample Translations

### 6.1 Portuguese (Brazilian)

**Translation Philosophy:**
- Use informal/friendly tone (você rather than formal usted)
- Cultural adaptations for capturing metaphors
- Common pt-BR tech terminology

**translations/pt-BR/landing.json (excerpt):**

```json
{
  "chicken": {
    "tabs": "Abas",
    "notes": "Anotações",
    "ideas": "Ideias",
    "signals": "Sinais",
    "links": "Links",
    "drafts": "Rascunhos",
    "threads": "Conversas",
    "clips": "Clipes",
    "bookmarks": "Favoritos",
    "photos": "Fotos",
    "voiceMemos": "Notas de Voz",
    "receipts": "Recibos"
  },
  "audience": {
    "personal": "Pessoal",
    "personalTone": "Reflexão e foco pessoal",
    "family": "Família",
    "familyTone": "Memória e apoio familiar",
    "friends": "Amigos",
    "friendsTone": "Momentum compartilhado com pares confiáveis",
    "community": "Comunidade",
    "communityTone": "Coordenação e administração coletivas"
  },
  "hero": {
    "callClip": "Trecho de chamada",
    "callClipText": "Capture o momento-chave antes que se disperse.",
    "browserTab": "Aba do navegador",
    "browserTabText": "Esse contato de subsídio vale um acompanhamento.",
    "fieldNote": "Anotação de campo",
    "fieldNoteText": "A energia dos membros está mudando essa semana.",
    "looseThread": "Conversa incompleta",
    "looseThreadText": "Lembre-se de reconectar isso após a reunião."
  },
  "howItWorks": {
    "title1": "Seus dados continuam sendo seus",
    "detail1": "Tudo que você captura fica no seu dispositivo até seu grupo decidir o que compartilhar.",
    "title2": "Um lugar para tudo",
    "detail2": "Abas, anotações, arquivos e fragmentos de chamadas se juntam antes de se dispersarem.",
    "title3": "Loop de revisão compartilhada",
    "detail3": "Uma fila clara para o grupo em vez de procurar em chats, navegadores e memória.",
    "title4": "Prova que perdura",
    "detail4": "O progresso e os resultados ficam perto do trabalho, facilitando revisitar e confiar nas atualizações."
  }
}
```

### 6.2 Spanish

**Translation Philosophy:**
- Inclusive Spanish (not Spain-specific, but compatible with both)
- Use neutral "vosotros" translations that work across regions
- Common startup vocabulary

**Key Phrases:**
```json
{
  "hero": {
    "callClipText": "Captura el momento clave antes de que se pierda.",
    "browserTabText": "Este contacto de subvención merece un seguimiento.",
    "fieldNoteText": "La energía del grupo está cambiando esta semana.",
    "looseThreadText": "Recuerda reconectar esto después de la reunión."
  },
  "howItWorks": {
    "title1": "Tus datos siguen siendo tuyos",
    "detail1": "Todo lo que capturas se queda en tu dispositivo hasta que tu grupo decida qué compartir.",
    "title2": "Un lugar para todo",
    "detail2": "Pestañas, notas, archivos y fragmentos de llamadas se juntan antes de dispersarse.",
    "title3": "Ciclo de revisión compartida",
    "detail3": "Una cola clara para el grupo en lugar de buscar en chats, navegadores y memoria.",
    "title4": "Prueba que perdura",
    "detail4": "El progreso y los resultados se mantienen cerca del trabajo para que las actualizaciones sean más fáciles de revisar y confiar."
  }
}
```

### 6.3 Mandarin Chinese (Simplified)

**Translation Philosophy:**
- Use simplified characters (zh-CN standard)
- Adapt farming/nature metaphors (chickens/coops are culturally resonant)
- Keep technical Web3 terms in English where appropriate

**Key Challenges & Solutions:**
| English | Challenge | Solution |
|---------|-----------|----------|
| "loose thread" | Too abstract | "未完成的讨论" (unfinished discussion) |
| "draft" | Can mean multiple things | "草稿" (literally: rough/draft) |
| "clip" | Ambiguous | "视频片段" (video clip) or "语音片段" (voice clip) |

**translations/zh-CN/landing.json (excerpt):**

```json
{
  "chicken": {
    "tabs": "标签页",
    "notes": "笔记",
    "ideas": "想法",
    "signals": "信号",
    "links": "链接",
    "drafts": "草稿",
    "threads": "话题",
    "clips": "片段",
    "bookmarks": "书签",
    "photos": "照片",
    "voiceMemos": "语音备忘录",
    "receipts": "凭证"
  },
  "audience": {
    "personal": "个人",
    "personalTone": "个人专注与反思",
    "family": "家庭",
    "familyTone": "家庭记忆与支持",
    "friends": "朋友",
    "friendsTone": "与信任的同伴共同推进",
    "community": "社区",
    "communityTone": "集体协调与管理"
  },
  "hero": {
    "callClip": "通话片段",
    "callClipText": "在关键时刻消失前捕捉它。",
    "browserTab": "浏览器标签页",
    "browserTabText": "这个资助线索值得跟进。",
    "fieldNote": "现场笔记",
    "fieldNoteText": "成员的状态本周在发生变化。",
    "looseThread": "未完成的讨论",
    "looseThreadText": "记得在会议后重新连接这个话题。"
  }
}
```

### 6.4 French

**Translation Philosophy:**
- Maintain formality level (vous-friendly for landing page)
- Use French startup vocabulary where available
- Handle gender agreement in UI labels

**Key Phrases:**

```json
{
  "audience": {
    "personal": "Personnel",
    "personalTone": "Concentration et réflexion personnelles",
    "family": "Famille",
    "familyTone": "Mémoire et soutien familiaux",
    "friends": "Amis",
    "friendsTone": "Élan partagé avec des pairs de confiance",
    "community": "Communauté",
    "communityTone": "Coordination et intendance collectives"
  },
  "hero": {
    "callClipText": "Capturez le moment clé avant qu'il ne s'efface.",
    "browserTabText": "Ce contact de subvention mérite un suivi.",
    "fieldNoteText": "L'énergie du groupe change cette semaine.",
    "looseThreadText": "N'oubliez pas de reconnecter cela après la réunion."
  },
  "howItWorks": {
    "title1": "Vos données vous restent",
    "detail1": "Tout ce que vous capturez reste sur votre appareil jusqu'à ce que votre groupe décide de partager.",
    "title2": "Un endroit pour tout",
    "detail2": "Les onglets, notes, fichiers et fragments d'appels se réunissent avant de se disperser.",
    "title3": "Boucle de révision partagée",
    "detail3": "Une file d'attente claire pour le groupe au lieu de chercher dans les chats, navigateurs et la mémoire.",
    "title4": "Preuve qui dure",
    "detail4": "Le progrès et les résultats restent proches du travail pour que les mises à jour soient plus faciles à revoir et approuver."
  }
}
```

---

## 7. Migration Strategy

### Phase 1: Extraction (Week 1)
1. Create i18n directory structure
2. Write extraction script to pull all strings from landing-data.ts
3. Build JSON translation files (English as source)

### Phase 2: Framework Integration (Week 1-2)
1. Install i18next and react-i18next
2. Create config.ts with Vite HMR setup
3. Update landing-data.ts to use i18n keys
4. Add LanguageSwitcher component

### Phase 3: Translation Handoff (Week 2-3)
1. Submit JSON files to translators (professional vs. community)
2. Set up CI/CD to validate translation completeness
3. Integrate with Crowdin or similar if scaling beyond 5 languages

### Phase 4: QA & Launch (Week 3-4)
1. Test each language path
2. Verify URL persistence and localStorage
3. Test speech recognition in non-English languages
4. Lighthouse performance check

---

## 8. Integration Points in landing-data.ts

### Before (Current)

```typescript
export const journeyChickens: JourneyChicken[] = [
  { id: 'tabs', label: 'Tabs', facing: 'right' },
  { id: 'notes', label: 'Notes', facing: 'right' },
  // ...
];

export const howItWorksCards: StoryCard[] = [
  {
    title: 'Your data stays yours',
    detail: 'Everything you capture stays on your device...',
  },
  // ...
];
```

### After (With i18n)

```typescript
// packages/app/src/views/Landing/landing-data.ts
import { useTranslation } from 'react-i18next';

// These IDs remain constant; translation happens in components
export const journeyChickenIds = [
  'tabs', 'notes', 'ideas', 'signals', 'links', 'drafts',
  'threads', 'clips', 'bookmarks', 'photos', 'voiceMemos', 'receipts'
] as const;

// Components now handle translation
// packages/app/src/views/Landing/index.tsx
export function ChickenLabel({ id }: { id: string }) {
  const { t } = useTranslation('landing');
  return <span>{t(`chicken.${id}`)}</span>;
}

export function HowItWorksSection() {
  const { t } = useTranslation('landing');
  
  return (
    <section>
      <div className="story-card">
        <h3>{t('howItWorks.title1')}</h3>
        <p>{t('howItWorks.detail1')}</p>
      </div>
      {/* ... repeat for all 4 cards */}
    </section>
  );
}
```

---

## 9. Component: LanguageSwitcher.tsx

**File: packages/app/src/components/LanguageSwitcher.tsx**

```typescript
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'es', label: 'Español' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'fr', label: 'Français' },
] as const;

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    
    // Persist to localStorage
    localStorage.setItem('coop-landing-language', lang);
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className={`language-switcher ${className || ''}`}>
      <label htmlFor="lang-select">Language:</label>
      <select
        id="lang-select"
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="lang-select"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

// CSS: packages/app/src/styles/language-switcher.css
.language-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.language-switcher label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.lang-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: white;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.lang-select:hover {
  border-color: var(--color-border-hover);
}

.lang-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
}
```

---

## 10. Vite Configuration

**File: packages/app/vite.config.ts (updated)**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  // Enable HMR for i18n translation files
  server: {
    middlewareMode: false,
    watch: {
      include: ['src/**', 'src/i18n/translations/**'],
    },
  },

  // Ensure JSON imports work
  optimizeDeps: {
    exclude: ['src/i18n/translations'],
  },

  build: {
    // Code split by namespace for faster loads
    rollupOptions: {
      output: {
        manualChunks: {
          'i18n-en': ['src/i18n/translations/en/common.json'],
          'i18n-pt': ['src/i18n/translations/pt-BR/common.json'],
          'i18n-es': ['src/i18n/translations/es/common.json'],
          'i18n-zh': ['src/i18n/translations/zh-CN/common.json'],
          'i18n-fr': ['src/i18n/translations/fr/common.json'],
        },
      },
    },
  },
});
```

---

## 11. TypeScript Support

**File: packages/app/src/i18n/types.ts**

```typescript
import type en from './translations/en/common.json';

// Create a type-safe translation key structure
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof en;
      landing: typeof import('./translations/en/landing.json');
      ritual: typeof import('./translations/en/ritual.json');
      errors: typeof import('./translations/en/errors.json');
    };
  }
}

// Usage in components:
// const { t } = useTranslation(); // Full type inference
// t('hero.callClipText') // ✓ Autocomplete works!
```

---

## 12. Performance Considerations

### Bundle Impact
- **Before i18n**: ~45KB (app + landing)
- **After i18n**: ~48KB (i18next) + ~25KB (all JSON translations)
- **Mitigation**: Code split by language, lazy load on demand

### Load Time Strategy
```typescript
// Load only active language + fallback
const languageChunkMap = {
  'en': () => import('./i18n/translations/en'),
  'pt-BR': () => import('./i18n/translations/pt-BR'),
  'es': () => import('./i18n/translations/es'),
  'zh-CN': () => import('./i18n/translations/zh-CN'),
  'fr': () => import('./i18n/translations/fr'),
};

// Preload English (fallback) and detected language
preloadLanguages(['en', detectLanguage()]);
```

### Optimization Checklist
- [ ] Minify JSON translation files
- [ ] Gzip compression in production
- [ ] Lazy load non-active languages
- [ ] Cache translations in localStorage
- [ ] Service Worker caching strategy

---

## 13. Challenging Phrases

### Phrases Requiring Cultural Adaptation

| English | Portuguese | Spanish | Mandarin | French | Notes |
|---------|-----------|---------|----------|--------|-------|
| "Loose thread" | "Conversa incompleta" | "Hilo suelto" | "未完成的讨论" | "Fil rouge" | Metaphorical; context-dependent |
| "Proof that lasts" | "Prova que perdura" | "Prueba que perdura" | "持久的证明" | "Preuve qui dure" | Abstract concept |
| "Member energy" | "Energia dos membros" | "Energía del grupo" | "成员的状态" | "Énergie du groupe" | Idiomatic |
| "drift" (lose track) | "dispersar" | "dispersarse" | "消失" | "s'efface" | Requires expansion |

### Best Practices for Each Language

**Portuguese/Spanish:** Flexible with verb tenses; friendly tone works best  
**Mandarin:** Use simpler nouns, avoid complex metaphors  
**French:** Maintain formality; ensure gender agreement in UI  

---

## 14. Testing Strategy

### Unit Tests for i18n

```typescript
// packages/app/src/__tests__/landing.i18n.test.tsx
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';
import { Landing } from '../views/Landing';

describe('Landing Page i18n', () => {
  it('renders English by default', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Landing />
      </I18nextProvider>
    );
    
    expect(screen.getByText('Your data stays yours')).toBeInTheDocument();
  });

  it('switches to Portuguese', async () => {
    await i18n.changeLanguage('pt-BR');
    render(
      <I18nextProvider i18n={i18n}>
        <Landing />
      </I18nextProvider>
    );
    
    expect(screen.getByText('Seus dados continuam sendo seus')).toBeInTheDocument();
  });

  it('persists language choice to URL', () => {
    const url = new URL('http://localhost:3001/?lang=es');
    // ... test URL handling
  });
});
```

### E2E Tests (Playwright)

```typescript
test('language switcher persists selection', async ({ page }) => {
  await page.goto('http://localhost:3001');
  
  // Select Spanish
  await page.selectOption('[data-testid="lang-select"]', 'es');
  
  // Verify URL updated
  expect(page.url()).toContain('lang=es');
  
  // Verify content switched
  await expect(page.locator('h1')).toContainText('Coop');
  
  // Reload and verify persistence
  await page.reload();
  expect(page.url()).toContain('lang=es');
});
```

---

## 15. Deployment & Monitoring

### Environment Variables
```bash
# .env.local
VITE_COOP_DEFAULT_LANGUAGE=en
VITE_COOP_SUPPORTED_LANGUAGES=en,pt-BR,es,zh-CN,fr
VITE_COOP_ENABLE_LANGUAGE_SWITCHER=true
```

### Monitoring
- Track language selection in analytics (Segment/Mixpanel)
- Monitor translation completeness via CI/CD
- Set up alerts for missing translation keys
- Track performance metrics per language

### Translation Management Platform Setup

**Recommended: Crowdin or i18nexus**

```yaml
# crowdin.yml
files:
  - source: /packages/app/src/i18n/translations/en/**/*.json
    translation: /packages/app/src/i18n/translations/%two_letters_code%/**/%original_file_name%
    
pull_request_title_template: 'i18n: Update translations for {{ target_language }}'
approval_settings:
  min_approval_percentage: 80
```

---

## 16. Quick Reference: File Checklist

### To Implement

- [ ] `packages/app/src/i18n/config.ts`
- [ ] `packages/app/src/i18n/lang-detector.ts`
- [ ] `packages/app/src/i18n/types.ts`
- [ ] `packages/app/src/i18n/translations/*/common.json` (5 languages)
- [ ] `packages/app/src/i18n/translations/*/landing.json` (5 languages)
- [ ] `packages/app/src/i18n/translations/*/ritual.json` (5 languages)
- [ ] `packages/app/src/i18n/translations/*/errors.json` (5 languages)
- [ ] `packages/app/src/components/LanguageSwitcher.tsx`
- [ ] `packages/app/src/styles/language-switcher.css`
- [ ] `packages/app/src/main.tsx` (i18n initialization)
- [ ] `packages/app/src/views/Landing/index.tsx` (migrate to hooks)
- [ ] `packages/app/vite.config.ts` (HMR + code splitting)
- [ ] `packages/app/src/__tests__/landing.i18n.test.tsx`
- [ ] `e2e/app-i18n.spec.cjs` (Playwright)

### Package Updates

```bash
# In packages/app/
npm install i18next react-i18next
npm install --save-dev i18next-parser
```

---

## 17. Migration Example: Single Component

### Before

```typescript
// packages/app/src/views/Landing/landing-data.ts
export const heroSignalFragments = [
  {
    id: 'call-clip',
    kicker: 'Call clip',
    text: 'Save the key moment before it drifts.',
    // ...
  },
];
```

### After (Phased)

**Step 1: Keep data, add i18n wrapper**

```typescript
// packages/app/src/views/Landing/landing-data-i18n.ts
import { useTranslation } from 'react-i18next';

export const heroSignalFragmentIds = ['call-clip', 'browser-tab', 'field-note', 'loose-thread'];

export function useHeroSignalFragments() {
  const { t } = useTranslation('landing');
  
  return heroSignalFragmentIds.map(id => ({
    id,
    kicker: t(`hero.${id}`),
    text: t(`hero.${id}Text`),
    // ... other properties
  }));
}
```

**Step 2: Update component**

```typescript
// packages/app/src/views/Landing/index.tsx
function HeroSection() {
  const fragments = useHeroSignalFragments();
  
  return (
    <div className="hero">
      {fragments.map(f => (
        <div key={f.id} className="signal-fragment">
          <strong>{f.kicker}</strong>
          <p>{f.text}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Summary & Next Steps

### i18n Setup: Complete Roadmap

**Recommendation:** Use **i18next + react-i18next**

**Why:**
1. Industry standard with 100K+ GitHub stars
2. Perfect for React 19 + Vite stack
3. Scales from 2 languages to 50+
4. Type-safe with TypeScript
5. Supports dynamic language switching
6. Works with translation platforms (Crowdin, etc.)

**Implementation Timeline:**
- **Week 1**: Framework setup + extraction
- **Week 2**: Translation handoff + integration
- **Week 3**: QA + launch

**Key Files to Create:** 26 JSON files + 5 TypeScript files

**Testing Scope:**
- Unit tests for each language
- E2E tests for language switching
- Performance checks per language

**Ongoing Maintenance:**
- Monitor translation completeness
- Track analytics by language
- Plan for language expansion

---

**Questions?** This guide covers:
- Framework selection rationale
- Complete file structure
- Sample translations for 4 languages
- Integration patterns with existing code
- Performance & deployment strategy
- TypeScript type safety
- Testing approach

