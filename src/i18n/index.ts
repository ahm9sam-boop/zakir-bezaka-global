import { LanguageCode } from '../types';
import { LANGUAGES, LanguageMeta, TranslationSchema } from './types';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { de } from './locales/de';
import { tr } from './locales/tr';
import { pt } from './locales/pt';
import { id } from './locales/id';
import { hi } from './locales/hi';
import { ru } from './locales/ru';

export { LANGUAGES };
export type { LanguageMeta, TranslationSchema };

export const LOCALES: Record<LanguageCode, TranslationSchema> = {
  ar,
  en,
  fr,
  es,
  de,
  tr,
  pt,
  id,
  hi,
  ru,
};

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  if (!code) return false;
  return LANGUAGES.some((l) => l.code === code);
}

export function getLanguageMeta(code: LanguageCode): LanguageMeta {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES[1];
}

export function detectBrowserLanguage(): LanguageCode {
  try {
    const candidates: string[] = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
      if (navigator.language) candidates.push(navigator.language);
    }
    for (const raw of candidates) {
      const base = raw.toLowerCase().split('-')[0];
      if (isSupportedLanguage(base)) {
        return base;
      }
    }
  } catch {
    // Fallback below
  }
  return 'en';
}
