import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { LanguageSetting } from '@/i18n';
import type { Hsv } from '@/theme/color';
import { NIGHT_BACKGROUND, type AccentSetting } from '@/theme/palette';

export type BackgroundMode = 'auto' | 'escuro' | 'claro' | 'cor';

/** Relógio de teste, só no modo de desenvolvimento (ver `applyTestClock`). */
export type TestClock = 'real' | 'noite' | 'manha';

/** O combinado sobre mandar a voz para a IA: ainda não perguntado, aceito ou recusado. */
export type AiConsent = 'unknown' | 'granted' | 'declined';

export type Settings = {
  onboarded: boolean;
  name: string;
  accentId: AccentSetting;
  /** Cor da roda, usada quando `accentId` é "custom". */
  accentCustom: Hsv;
  backgroundMode: BackgroundMode;
  /** Com o modo "cor": um fundo pronto (`backgroundColor`) ou a cor da roda (`backgroundCustom`). */
  backgroundSource: 'preset' | 'custom';
  backgroundColor: string;
  backgroundCustom: Hsv;
  nightMinutes: number;
  morningMinutes: number;
  language: LanguageSetting;
  /** "Me manter conectado" do login: guarda a sessão neste celular. */
  keepSignedIn: boolean;
  /** Frase curta do perfil. */
  bio: string;
  /** Conta privada: só quem a pessoa aprova entra na órbita dela. */
  privateAccount: boolean;
  /** O mural fecha do horário da noite até o resumo da manhã. */
  muralSleeps: boolean;
  /** Avisos dos amigos (push), um por tipo: brilho no céu, cutucão, brilho no Mural e pedido para seguir. */
  pushShine: boolean;
  pushPoke: boolean;
  pushMural: boolean;
  pushRequests: boolean;
  /** Nome que a pessoa deu a cada constelação do Seu céu ('AAAA-MM' → nome). Sem nome, vale o da lista pronta. */
  constellationNames: Record<string, string>;
  testClock: TestClock;
  aiConsent: AiConsent;
  /** Quando a pessoa aceitou ou recusou (registro do consentimento, pela LGPD). */
  aiConsentAt: number | null;
  /** Versão do texto que ela aceitou: se o texto mudar, o app pergunta de novo. */
  aiConsentVersion: number;
};

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  name: '',
  accentId: 'classico',
  accentCustom: { h: 160, s: 0.45, v: 0.86 },
  backgroundMode: 'auto',
  backgroundSource: 'preset',
  backgroundColor: NIGHT_BACKGROUND,
  backgroundCustom: { h: 265, s: 0.55, v: 0.24 },
  nightMinutes: 22 * 60 + 30,
  morningMinutes: 7 * 60,
  language: 'device',
  keepSignedIn: true,
  bio: '',
  privateAccount: true,
  muralSleeps: false,
  pushShine: true,
  pushPoke: true,
  pushMural: true,
  pushRequests: true,
  constellationNames: {},
  testClock: 'real',
  aiConsent: 'unknown',
  aiConsentAt: null,
  aiConsentVersion: 0,
};

const STORAGE_KEY = 'mindfree.settings.v1';

export function loadSettings(): Settings {
  try {
    const saved = Storage.getItemSync(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...(JSON.parse(saved) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: Settings;
  update: (changes: Partial<Settings>) => void;
  reset: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadSettings);

  // Salva com um pequeno atraso para não gravar a cada movimento da roda de cores.
  useEffect(() => {
    const timeout = setTimeout(() => {
      Storage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timeout);
  }, [settings]);

  const update = (changes: Partial<Settings>) => setSettings((current) => ({ ...current, ...changes }));
  const reset = () => setSettings(DEFAULT_SETTINGS);

  return <SettingsContext value={{ settings, update, reset }}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextValue {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings precisa estar dentro de SettingsProvider.');
  return value;
}
