import { contrastRatio, ensureContrast, hexToHsl, hslToHex, isDarkColor, withAlpha } from '@/theme/color';

/** A mesma cor, alguns pontos mais clara (positivo) ou mais escura (negativo). */
function shade(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.min(Math.max(l + amount, 0), 100));
}

/** Cor de destaque escolhida: uma pronta (com tons de dia e de tinta) ou qualquer cor da roda. */
export type AccentChoice = { fill: string; dayFill?: string; ink?: string };

export type ThemeTokens = {
  dark: boolean;
  background: string;
  surface: string;
  /** Fundo de botões redondos, trilhos e controles segmentados. */
  raised: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  /** Degradê do botão principal: um pouco mais claro em cima e mais escuro embaixo. */
  accentGradient: string;
  /** Brilho suave embaixo do botão principal. */
  accentGlow: string;
  /** Sombra dos cartões, mais forte no escuro e quente no claro. */
  cardShadow: string;
  /** Destaque para ícones e textos sobre o fundo, sempre com contraste suficiente. */
  accentStrong: string;
  onAccent: string;
  danger: string;
  /** O fundo escolhido deixa a leitura cansativa (texto com contraste baixo). */
  lowTextContrast: boolean;
  /** A cor de destaque quase some no fundo (botões pouco visíveis). */
  accentBlendsIn: boolean;
};

const INK_ON_LIGHT = '#10142E';
const INK_ON_DARK = '#FFFFFF';

/**
 * Monta as cores do app a partir de qualquer fundo e qualquer destaque.
 * As cores escolhidas são usadas como estão; letras e ícones são clareados ou escurecidos
 * até ficarem legíveis (contraste mínimo de 4,5:1, o padrão de acessibilidade WCAG AA).
 */
export function buildTheme(background: string, accent: AccentChoice): ThemeTokens {
  const { h, s, l } = hexToHsl(background);
  const dark = isDarkColor(background);
  const fill = !dark && accent.dayFill ? accent.dayFill : accent.fill;

  const textBase = dark ? hslToHex(h, Math.min(s, 60), 96) : hslToHex(h, Math.min(s, 30), 12);

  // Cartões e controles se afastam da cor do texto, para ele continuar legível em cima deles
  // (em fundos de tom médio, clarear o cartão deixaria o texto branco ilegível).
  const surface = ensureContrast(dark ? hslToHex(h, s, Math.min(l + 6, 100)) : '#FFFFFF', [textBase], 7);
  const raised = ensureContrast(
    dark ? hslToHex(h, s, Math.min(l + 11, 100)) : hslToHex(h, Math.min(s, 70), Math.max(l - 5, 0)),
    [textBase],
    4.5,
  );
  const border = dark ? hslToHex(h, s, Math.min(l + 14, 100)) : hslToHex(h, Math.min(s, 50), Math.max(l - 10, 0));
  const surfaces = [background, surface];

  const text = ensureContrast(textBase, surfaces, 7);
  const textSecondary = ensureContrast(
    dark ? hslToHex(h, Math.min(s, 30), 76) : hslToHex(h, Math.min(s, 18), 36),
    surfaces,
    4.5,
  );
  // Texto do botão: o azul-noite da marca ou branco; em cores de tom médio (ex.: vermelho vivo),
  // só o preto puro alcança 4,5:1.
  const bestOn = (inks: string[]) =>
    inks.reduce((best, ink) => (contrastRatio(ink, fill) > contrastRatio(best, fill) ? ink : best));
  const brandInk = bestOn([INK_ON_LIGHT, INK_ON_DARK]);
  const onAccent = contrastRatio(brandInk, fill) >= 4.5 ? brandInk : bestOn(['#000000', INK_ON_DARK]);

  return {
    dark,
    background,
    surface,
    raised,
    border,
    text,
    textSecondary,
    accent: fill,
    accentGradient: `linear-gradient(180deg, ${shade(fill, 6)} 0%, ${shade(fill, -6)} 100%)`,
    accentGlow: `0px 14px 30px -14px ${withAlpha(fill, 0.85)}`,
    cardShadow: dark
      ? '0px 18px 36px -24px rgba(0, 0, 0, 0.75)'
      : '0px 1px 2px rgba(43, 29, 18, 0.06), 0px 14px 30px -20px rgba(43, 29, 18, 0.35)',
    accentStrong: ensureContrast(dark ? fill : (accent.ink ?? fill), surfaces, 4.5),
    onAccent,
    danger: ensureContrast(dark ? '#FF9B8F' : '#B42318', surfaces, 4.5),
    lowTextContrast: contrastRatio(text, background) < 5.5,
    accentBlendsIn: contrastRatio(fill, background) < 1.6,
  };
}
