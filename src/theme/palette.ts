export type AccentId = 'classico' | 'lilas' | 'azul' | 'verde' | 'rosa' | 'coral' | 'ambar';

/** O que fica salvo: uma das cores prontas ou a cor escolhida na roda. */
export type AccentSetting = AccentId | 'custom';

export type Accent = {
  id: AccentId;
  /** Preenchimento de botões e destaques em fundos escuros. */
  fill: string;
  /** Preenchimento em fundos claros, quando muda de dia (só o Clássico). */
  dayFill?: string;
  /** Tom forte para ícones e textos de destaque em fundos claros. */
  ink: string;
};

export const ACCENTS: Accent[] = [
  { id: 'classico', fill: '#B9A6FF', dayFill: '#FFC857', ink: '#B45309' },
  { id: 'lilas', fill: '#B9A6FF', ink: '#5B3FD1' },
  { id: 'azul', fill: '#8EC5FF', ink: '#1D5FB8' },
  { id: 'verde', fill: '#7FDBB6', ink: '#0F7A55' },
  { id: 'rosa', fill: '#FFA8C5', ink: '#B8336A' },
  { id: 'coral', fill: '#FFB38A', ink: '#B4501C' },
  { id: 'ambar', fill: '#FFC857', ink: '#B45309' },
];

export function accentById(id: AccentId): Accent {
  return ACCENTS.find((accent) => accent.id === id) ?? ACCENTS[0];
}

/** Listras do botão "qualquer cor", antes de a pessoa escolher a dela. */
export const RAINBOW = ['#FF6B6B', '#FFC857', '#7FDBB6', '#8EC5FF', '#B9A6FF'];

export const NIGHT_BACKGROUND = '#10142E';
export const DAY_BACKGROUND = '#FFF7EC';

export type BackgroundPresetId =
  | 'meiaNoite'
  | 'ameixa'
  | 'floresta'
  | 'oceano'
  | 'vinho'
  | 'grafite'
  | 'creme'
  | 'lavanda'
  | 'menta'
  | 'ceu'
  | 'rosado'
  | 'areia';

/** O nome de cada fundo vem das traduções (bg.<id>). */
export type BackgroundPreset = { id: BackgroundPresetId; hex: string };

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: 'meiaNoite', hex: NIGHT_BACKGROUND },
  { id: 'ameixa', hex: '#24143A' },
  { id: 'floresta', hex: '#0F2A24' },
  { id: 'oceano', hex: '#0B2233' },
  { id: 'vinho', hex: '#2A1220' },
  { id: 'grafite', hex: '#1A1B1F' },
  { id: 'creme', hex: DAY_BACKGROUND },
  { id: 'lavanda', hex: '#F3EEFF' },
  { id: 'menta', hex: '#EAF7F1' },
  { id: 'ceu', hex: '#EAF3FF' },
  { id: 'rosado', hex: '#FFF0F3' },
  { id: 'areia', hex: '#F5EFE6' },
];

/** Fundos mostrados no primeiro uso; os outros ficam nos Ajustes. */
export const ONBOARDING_BACKGROUNDS = BACKGROUND_PRESETS.filter((preset) =>
  (['meiaNoite', 'ameixa', 'floresta', 'oceano', 'creme', 'lavanda'] as BackgroundPresetId[]).includes(
    preset.id,
  ),
);
