import { getLocales, useLocales } from 'expo-localization';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { ar } from '@/i18n/locales/ar';
import { de } from '@/i18n/locales/de';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { fr } from '@/i18n/locales/fr';
import { hi } from '@/i18n/locales/hi';
import { it } from '@/i18n/locales/it';
import { ja } from '@/i18n/locales/ja';
import { ko } from '@/i18n/locales/ko';
import { ptBR, type MessageKey, type Messages } from '@/i18n/locales/pt-BR';
import { ptPT } from '@/i18n/locales/pt-PT';
import { zh } from '@/i18n/locales/zh';
import { useSettings } from '@/state/settings';

export type LanguageCode = 'pt-BR' | 'pt-PT' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'ko' | 'zh' | 'hi' | 'ar';
/** O que fica salvo: um idioma escolhido ou "o do celular". */
export type LanguageSetting = LanguageCode | 'device';

export type Language = { code: LanguageCode; short: string; native: string; rtl: boolean };

/** Os idiomas na ordem da lista, cada um escrito na própria língua. */
export const LANGUAGES: Language[] = [
  { code: 'pt-BR', short: 'PT', native: 'Português (Brasil)', rtl: false },
  { code: 'pt-PT', short: 'PT', native: 'Português (Portugal)', rtl: false },
  { code: 'en', short: 'EN', native: 'English', rtl: false },
  { code: 'es', short: 'ES', native: 'Español', rtl: false },
  { code: 'fr', short: 'FR', native: 'Français', rtl: false },
  { code: 'de', short: 'DE', native: 'Deutsch', rtl: false },
  { code: 'it', short: 'IT', native: 'Italiano', rtl: false },
  { code: 'ja', short: 'JA', native: '日本語', rtl: false },
  { code: 'ko', short: 'KO', native: '한국어', rtl: false },
  { code: 'zh', short: 'ZH', native: '中文（简体）', rtl: false },
  { code: 'hi', short: 'HI', native: 'हिन्दी', rtl: false },
  { code: 'ar', short: 'AR', native: 'العربية', rtl: true },
];

const MESSAGES: Record<LanguageCode, Messages> = {
  'pt-BR': ptBR,
  'pt-PT': ptPT,
  en,
  es,
  fr,
  de,
  it,
  ja,
  ko,
  zh,
  hi,
  ar,
};

export function languageByCode(code: LanguageCode): Language {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0];
}

/** O primeiro idioma do celular que o MindFree fala; se nenhum, português do Brasil. */
export function deviceLanguage(locales = getLocales()): LanguageCode {
  for (const locale of locales) {
    const code = locale.languageCode;
    if (code === 'pt') return locale.regionCode === 'PT' ? 'pt-PT' : 'pt-BR';
    const match = LANGUAGES.find((language) => language.code === code);
    if (match) return match.code;
  }
  return 'pt-BR';
}

export function resolveLanguage(setting: LanguageSetting, locales = getLocales()): LanguageCode {
  return setting === 'device' ? deviceLanguage(locales) : setting;
}

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

export function translator(language: LanguageCode): Translate {
  const messages = MESSAGES[language];
  return (key, params) => {
    const text = messages[key] ?? ptBR[key];
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  };
}

type I18nValue = { language: Language; t: Translate };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // Acompanha o celular: se a pessoa mudar o idioma do sistema, o app troca junto.
  const locales = useLocales();
  const code = resolveLanguage(settings.language, locales);
  const value = useMemo(() => ({ language: languageByCode(code), t: translator(code) }), [code]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n precisa estar dentro de I18nProvider.');
  return value;
}

export function useT(): Translate {
  return useI18n().t;
}

export type { MessageKey };
