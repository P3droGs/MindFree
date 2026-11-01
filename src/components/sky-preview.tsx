import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useAppTheme } from '@/theme/theme-provider';

const SKY = '#070A1C';

const DUST = [
  { cx: 200, cy: 22, r: 0.9 },
  { cx: 236, cy: 44, r: 0.8 },
  { cx: 20, cy: 74, r: 0.9 },
  { cx: 96, cy: 40, r: 0.7 },
  { cx: 150, cy: 70, r: 0.8 },
  { cx: 268, cy: 120, r: 0.9 },
  { cx: 330, cy: 88, r: 0.8 },
  { cx: 182, cy: 132, r: 0.7 },
];

/** Onde cada estrela do mês aparece no cartão, ligadas nesta ordem. */
export const SKY_CARD_POINTS: [number, number][] = [
  [40, 118],
  [84, 92],
  [124, 112],
  [164, 80],
  [210, 100],
  [246, 70],
  [290, 90],
  [318, 118],
  [196, 132],
  [128, 136],
];

type SkyPreviewProps = { title: string; subtitle: string; stars: number; onPress?: () => void };

/** Cartão do "Seu céu": uma estrela acesa para cada noite do mês em que a pessoa esvaziou a mente. */
export function SkyPreview({ title, subtitle, stars, onPress }: SkyPreviewProps) {
  const theme = useAppTheme();
  const lit = Math.min(stars, SKY_CARD_POINTS.length);
  const litPoints = SKY_CARD_POINTS.slice(0, lit);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${subtitle}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.sky, { opacity: pressed ? 0.85 : 1, boxShadow: theme.cardShadow }]}>
      <Svg width="100%" height="100%" viewBox="0 0 342 150" preserveAspectRatio="xMidYMid slice" style={styles.art}>
        {DUST.map((star) => (
          <Circle key={`${star.cx}-${star.cy}`} cx={star.cx} cy={star.cy} r={star.r} fill="#EEF0FF" opacity={0.4} />
        ))}
        <Circle cx={306} cy={34} r={14} fill={theme.dark ? theme.accent : '#C7B8FF'} opacity={0.9} />
        <Circle cx={312} cy={29} r={12} fill={SKY} />
        {lit > 1 ? (
          <Polyline
            points={litPoints.map((point) => point.join(',')).join(' ')}
            fill="none"
            stroke="#B9A6FF"
            strokeWidth={1.2}
            strokeOpacity={0.35}
            strokeLinejoin="round"
          />
        ) : null}
        {SKY_CARD_POINTS.map(([cx, cy], index) =>
          index < lit ? (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#FFF4D6" />
          ) : (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill="#EEF0FF" opacity={0.16} />
          ),
        )}
      </Svg>
      <View style={styles.text}>
        <AppText variant="heading" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="caption" style={styles.subtitle}>
          {subtitle}
        </AppText>
      </View>
      {onPress ? (
        <View style={styles.chevron}>
          <Icon name="chevron-right" size={16} color="#EEF0FF" strokeWidth={2.6} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sky: {
    height: 150,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E2350',
    backgroundColor: SKY,
    overflow: 'hidden',
    padding: 16,
  },
  art: { position: 'absolute', top: 0, left: 0 },
  text: { gap: 2, maxWidth: 260 },
  title: { color: '#EEF0FF' },
  subtitle: { color: '#C9CDEB' },
  chevron: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2350',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
