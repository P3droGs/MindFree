export type Hsl = { h: number; s: number; l: number };

/** Cor no formato da roda: matiz (0-360), quão viva (0-1) e brilho (0-1). */
export type Hsv = { h: number; s: number; v: number };

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace('#', ''), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

/** "#RRGGBB" com transparência, no formato rgba() que sombras e degradês aceitam. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex).map((channel) => Math.round(channel * 255));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Converte "#RRGGBB" em matiz (0-359), saturação e luminosidade (0-100). */
export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(channel(0), channel(8), channel(4));
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex(channel(5), channel(3), channel(1));
}

export function hsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Luminância relativa (WCAG), de 0 (preto) a 1 (branco). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre duas cores (WCAG): 1 = nenhum, 21 = preto no branco. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Fundos com luminância abaixo disso pedem texto claro; acima, texto escuro. */
export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.18;
}

/**
 * Clareia ou escurece `color` até ela atingir o contraste `target` com todos os fundos dados.
 * É o que protege a leitura quando a pessoa escolhe qualquer cor.
 */
export function ensureContrast(color: string, backgrounds: string[], target: number): string {
  const passes = (candidate: string) => backgrounds.every((bg) => contrastRatio(candidate, bg) >= target);
  if (passes(color)) return color;
  const lighten = isDarkColor(backgrounds[0]);
  const { h, s, l } = hexToHsl(color);
  for (let lightness = l; lightness >= 0 && lightness <= 100; lightness += lighten ? 2 : -2) {
    const candidate = hslToHex(h, s, lightness);
    if (passes(candidate)) return candidate;
  }
  return lighten ? '#FFFFFF' : '#000000';
}
