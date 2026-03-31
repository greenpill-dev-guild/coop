import { type ReactNode, createContext, useContext, useState } from 'react';
// biome-ignore lint/suspicious/noExplicitAny: allow any for JSON import
import translations from '../i18n/translations.json';

export type LanguageCode = 'en' | 'pt' | 'es' | 'zh' | 'fr';

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, defaultValue?: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('en');

  const t = (key: string, defaultValue = key): string => {
    const keys = key.split('.');
    // biome-ignore lint/suspicious/noExplicitAny: allow any for nested translation access
    let value: any = (translations as any)[language];

    for (const k of keys) {
      value = value?.[k];
      if (!value) break;
    }

    return typeof value === 'string' ? value : defaultValue;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
