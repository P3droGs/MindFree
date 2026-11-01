import { createContext, use, useMemo, type ReactNode } from 'react';

import { useNow } from '@/hooks/use-now';
import { isNight } from '@/lib/time';
import { useSettings, type Settings } from '@/state/settings';
import { hsvToHex } from '@/theme/color';
import { accentById, DAY_BACKGROUND, NIGHT_BACKGROUND } from '@/theme/palette';
import { buildTheme, type AccentChoice, type ThemeTokens } from '@/theme/tokens';

/** Cor de destaque escolhida: uma das prontas ou a da roda de cores. */
export function resolveAccent(settings: Pick<Settings, 'accentId' | 'accentCustom'>): AccentChoice {
  return settings.accentId === 'custom' ? { fill: hsvToHex(settings.accentCustom) } : accentById(settings.accentId);
}

/** Cor de fundo em uso agora, conforme o modo escolhido e o horário. */
export function resolveBackground(settings: Settings, now: Date): string {
  switch (settings.backgroundMode) {
    case 'escuro':
      return NIGHT_BACKGROUND;
    case 'claro':
      return DAY_BACKGROUND;
    case 'cor':
      return settings.backgroundSource === 'custom' ? hsvToHex(settings.backgroundCustom) : settings.backgroundColor;
    default:
      return isNight(now, settings.morningMinutes) ? NIGHT_BACKGROUND : DAY_BACKGROUND;
  }
}

const ThemeContext = createContext<ThemeTokens | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const now = useNow();
  const background = resolveBackground(settings, now);
  const { accentId, accentCustom } = settings;
  const theme = useMemo(
    () => buildTheme(background, resolveAccent({ accentId, accentCustom })),
    [background, accentId, accentCustom],
  );

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useAppTheme(): ThemeTokens {
  const theme = use(ThemeContext);
  if (!theme) throw new Error('useAppTheme precisa estar dentro de AppThemeProvider.');
  return theme;
}
