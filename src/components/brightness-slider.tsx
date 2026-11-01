import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useT } from '@/i18n';

const HEIGHT = 36;
const THUMB = 28;

type BrightnessSliderProps = {
  /** Brilho de 0 (preto) a 1 (cor cheia). */
  value: number;
  /** A cor no brilho máximo, para pintar a faixa. */
  color: string;
  thumbColor: string;
  onChange: (value: number) => void;
  onSlidingChange?: (sliding: boolean) => void;
};

/** Faixa do mais escuro ao mais claro da cor escolhida. */
export function BrightnessSlider({ value, color, thumbColor, onChange, onSlidingChange }: BrightnessSliderProps) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const gradientId = `brilho${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const pick = (x: number) => {
    if (width <= 0) return;
    onChange(Math.round(Math.min(Math.max(x / width, 0), 1) * 100) / 100);
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('color.brightness')}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onChange(Math.min(Math.max(value + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1), 0), 1))
      }
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        onSlidingChange?.(true);
        pick(event.nativeEvent.locationX);
      }}
      onResponderMove={(event) => pick(event.nativeEvent.locationX)}
      onResponderRelease={() => onSlidingChange?.(false)}
      onResponderTerminate={() => onSlidingChange?.(false)}
      style={styles.track}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT} pointerEvents="none" style={styles.art}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000000" />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={HEIGHT} rx={HEIGHT / 2} fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      <View
        pointerEvents="none"
        style={[styles.thumb, { left: value * width - THUMB / 2, backgroundColor: thumbColor }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: HEIGHT, justifyContent: 'center' },
  art: { position: 'absolute', top: 0, left: 0 },
  thumb: {
    position: 'absolute',
    top: (HEIGHT - 44) / 2,
    width: THUMB,
    height: 44,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
