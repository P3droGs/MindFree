import { useId, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { useT } from '@/i18n';
import { hsvToHex } from '@/theme/color';

const WEDGE_COUNT = 72;
const MAX_SIZE = 260;
const THUMB = 30;

type ColorWheelProps = {
  hue: number;
  saturation: number;
  brightness: number;
  onChange: (color: { h: number; s: number }) => void;
  onSlidingChange?: (sliding: boolean) => void;
};

/** Fatias de cor pura em volta do círculo; uma pequena sobra entre elas esconde as emendas. */
function buildWedges(radius: number) {
  if (radius <= 0) return [];
  const step = 360 / WEDGE_COUNT;
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${radius + radius * Math.cos(radians)} ${radius + radius * Math.sin(radians)}`;
  };
  return Array.from({ length: WEDGE_COUNT }, (_, index) => {
    const hue = index * step;
    const start = point(hue - step / 2 - 0.6);
    const end = point(hue + step / 2 + 0.6);
    return { hue, d: `M ${radius} ${radius} L ${start} A ${radius} ${radius} 0 0 1 ${end} Z` };
  });
}

/**
 * Roda de cores: o ângulo escolhe a cor e a distância do centro escolhe o quanto ela é viva
 * (no centro fica branca). O brilho vem de fora e escurece a roda inteira.
 */
export function ColorWheel({ hue, saturation, brightness, onChange, onSlidingChange }: ColorWheelProps) {
  const t = useT();
  const [size, setSize] = useState(0);
  const gradientId = `centro${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const radius = size / 2;
  const wedges = useMemo(() => buildWedges(radius), [radius]);

  const pick = (x: number, y: number) => {
    if (radius <= 0) return;
    const dx = x - radius;
    const dy = y - radius;
    const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
    onChange({
      h: Math.round((degrees + 360) % 360),
      s: Math.round(Math.min(Math.hypot(dx, dy) / radius, 1) * 100) / 100,
    });
  };

  const thumbX = radius + saturation * radius * Math.cos((hue * Math.PI) / 180);
  const thumbY = radius + saturation * radius * Math.sin((hue * Math.PI) / 180);

  return (
    <View onLayout={(event) => setSize(Math.min(event.nativeEvent.layout.width, MAX_SIZE))} style={styles.container}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('color.wheel')}
        accessibilityValue={{ text: hsvToHex({ h: hue, s: saturation, v: brightness }) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onChange({ h: (hue + (event.nativeEvent.actionName === 'increment' ? 15 : 345)) % 360, s: saturation || 1 })
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          onSlidingChange?.(true);
          pick(event.nativeEvent.locationX, event.nativeEvent.locationY);
        }}
        onResponderMove={(event) => pick(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        onResponderRelease={() => onSlidingChange?.(false)}
        onResponderTerminate={() => onSlidingChange?.(false)}
        style={{ width: size, height: size }}>
        {size > 0 ? (
          <Svg width={size} height={size} pointerEvents="none">
            <Defs>
              <RadialGradient id={gradientId} cx={radius} cy={radius} r={radius} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {wedges.map((wedge) => (
              <Path key={wedge.hue} d={wedge.d} fill={hsvToHex({ h: wedge.hue, s: 1, v: 1 })} />
            ))}
            <Circle cx={radius} cy={radius} r={radius} fill={`url(#${gradientId})`} />
            <Circle cx={radius} cy={radius} r={radius} fill="#000000" opacity={1 - brightness} />
          </Svg>
        ) : null}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: thumbX - THUMB / 2,
              top: thumbY - THUMB / 2,
              backgroundColor: hsvToHex({ h: hue, s: saturation, v: brightness }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});
