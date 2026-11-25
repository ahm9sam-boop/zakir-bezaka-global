import React, { createContext, useContext, useEffect, useState } from 'react';
import { LanguageCode } from '../types';
import {
  LOCALES,
  LANGUAGES,
  LanguageMeta,
  TranslationSchema,
  detectBrowserLanguage,
  getLanguageMeta,
  isSupportedLanguage,
} from '../i18n';
import { safeStorageGet, safeStorageSet } from '../utils/storage';

const STORAGE_KEY = 'zakir_lang_v1';

interface LanguageContextValue {
  lang: LanguageCode;
  langMeta: LanguageMeta;
  isRtl: boolean;
  t: TranslationSchema;
  setLang: (code: LanguageCode) => void;
  languages: LanguageMeta[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = safeStorageGet<string>(STORAGE_KEY, '');
    if (isSupportedLanguage(saved)) return saved;
    return detectBrowserLanguage();
  });

  const langMeta = getLanguageMeta(lang);
  const t = LOCALES[lang];
  const isRtl = langMeta.dir === 'rtl';

  const setLang = (code: LanguageCode) => {
    setLangState(code);
    safeStorageSet(STORAGE_KEY, code);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = langMeta.code;
      document.documentElement.dir = langMeta.dir;
      document.title = t.seoTitle;

      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', t.seoDescription);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', t.seoTitle);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', t.seoDescription);
    }
  }, [langMeta, t]);

  return (
    <LanguageContext.Provider value={{ lang, langMeta, isRtl, t, setLang, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
