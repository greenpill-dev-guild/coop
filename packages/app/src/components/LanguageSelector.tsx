import { type LanguageCode, useI18n } from '../hooks/useI18n';
import '../styles/language-selector.css';

const LANGUAGES: Array<{ code: LanguageCode; label: string; nativeName: string }> = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'pt', label: 'Português', nativeName: 'Português' },
  { code: 'es', label: 'Español', nativeName: 'Español' },
  { code: 'zh', label: '中文', nativeName: '中文' },
  { code: 'fr', label: 'Français', nativeName: 'Français' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="language-selector-shell">
      <div className="language-selector-group">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            className={`language-selector-button ${language === lang.code ? 'is-active' : ''}`}
            onClick={() => setLanguage(lang.code)}
            title={lang.label}
            aria-pressed={language === lang.code}
          >
            <span className="language-selector-code">{lang.code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
