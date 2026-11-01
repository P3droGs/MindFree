import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';

/** A pessoa como um planeta com anel; o anel fica dourado quando ela acendeu a estrela de hoje. */
export function PlanetAvatar({
  initial,
  color,
  size = 46,
  lit = false,
}: {
  initial: string;
  color: string;
  size?: number;
  lit?: boolean;
}) {
  const ring = lit ? '#FFC857' : '#4A4F8C';
  const half = size / 2;
  const planet = size * 0.33;
  const rx = size * 0.48;
  const ry = size * 0.15;
  const tilt = `rotate(-18 ${half} ${half + 2})`;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Ellipse cx={half} cy={half + 2} rx={rx} ry={ry} fill="none" stroke={ring} strokeWidth={2} transform={tilt} />
        <Circle cx={half} cy={half} r={planet} fill={color} />
        <Path
          d={`M${half - rx} ${half + 2} A ${rx} ${ry} 0 0 0 ${half + rx} ${half + 2}`}
          fill="none"
          stroke={ring}
          strokeWidth={2}
          transform={tilt}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <AppText variant="bodyStrong" style={[styles.initial, { fontSize: Math.round(size * 0.32) }]}>
          {initial}
        </AppText>
      </View>
    </View>
  );
}

/** Foto de perfil redonda com o anel dourado (por enquanto, a inicial do nome). */
export function ProfileBadge({ initial, size = 34, background }: { initial: string; size?: number; background: string }) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: `0px 0px 0px 2px ${background}, 0px 0px 0px 4px #FFC857`,
        },
      ]}>
      <AppText variant="bodyStrong" style={[styles.initial, { fontSize: Math.round(size * 0.44) }]}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#10142E', lineHeight: undefined },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D3B9F2',
    experimental_backgroundImage: 'linear-gradient(160deg, #FFB8CF 0%, #B9A6FF 100%)',
  },
});
