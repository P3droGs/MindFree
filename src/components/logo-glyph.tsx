import Svg, { Circle, Line, Path } from 'react-native-svg';

/** A estrela de quatro pontas do logo, com os lados curvos para dentro. */
function sparkle(x: number, y: number, r: number): string {
  const k = 0.16;
  const j = 0.38;
  return [
    `M ${x} ${y - r}`,
    `C ${x + r * k} ${y - r * j}, ${x + r * j} ${y - r * k}, ${x + r} ${y}`,
    `C ${x + r * j} ${y + r * k}, ${x + r * k} ${y + r * j}, ${x} ${y + r}`,
    `C ${x - r * k} ${y + r * j}, ${x - r * j} ${y + r * k}, ${x - r} ${y}`,
    `C ${x - r * j} ${y - r * k}, ${x - r * k} ${y - r * j}, ${x} ${y - r}`,
    'Z',
  ].join(' ');
}

const STAR = sparkle(712, 383, 175);

/**
 * O logo do MindFree: um "feito" em forma de constelação que termina numa estrela.
 * O mesmo desenho do ícone do app (assets/images/icon.png), recortado no que ele ocupa.
 */
export function LogoGlyph({ size, line = '#D9CFFF', star = '#FFC857' }: { size: number; line?: string; star?: string }) {
  return (
    <Svg width={size} height={size} viewBox="170 198 727 610" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={226} cy={584} r={46} fill={line} />
      <Line x1={280} y1={630} x2={334} y2={680} stroke={line} strokeWidth={40} strokeLinecap="round" />
      <Circle cx={394} cy={740} r={58} fill={line} />
      <Line x1={452} y1={676} x2={648} y2={454} stroke={line} strokeWidth={40} strokeLinecap="round" />
      <Path d={STAR} fill={star} />
    </Svg>
  );
}
