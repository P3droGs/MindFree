import { Circle, Image, Rectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  offset,
  opacity,
  rotationEffect,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import type { SkyWidgetProps } from '@/widgets/widget-content';

/** Widget "Seu céu" do iPhone: as estrelas que a pessoa acendeu no mês. */
const SkyLayout = (props: SkyWidgetProps) => {
  'widget';
  // Mesmas posições de SKY_STAR_POSITIONS, em widget-content.ts.
  const positions = [
    [0.08, 0.72],
    [0.24, 0.5],
    [0.38, 0.66],
    [0.52, 0.34],
    [0.67, 0.54],
    [0.81, 0.28],
    [0.93, 0.48],
    [0.62, 0.08],
  ];
  const width = 104;
  const height = 52;
  const lit = Math.min(props.stars, positions.length);
  const caption = props.caption;

  const lines = positions.slice(1, lit).map((point, index) => {
    const from = positions[index];
    const dx = (point[0] - from[0]) * width;
    const dy = (point[1] - from[1]) * height;
    const length = Math.sqrt(dx * dx + dy * dy);
    const centerX = ((point[0] + from[0]) / 2) * width;
    const centerY = ((point[1] + from[1]) / 2) * height;
    return (
      <Rectangle
        key={'line-' + index}
        modifiers={[
          frame({ width: length, height: 1 }),
          foregroundStyle('#B9A6FF'),
          opacity(0.45),
          rotationEffect((Math.atan2(dy, dx) * 180) / Math.PI),
          offset({ x: centerX - length / 2, y: centerY - 0.5 }),
        ]}
      />
    );
  });
  const stars = positions.map((point, index) => (
    <Circle
      key={'star-' + index}
      modifiers={[
        frame({ width: 6, height: 6 }),
        foregroundStyle(index < lit ? '#FFF4D6' : '#EEF0FF'),
        opacity(index < lit ? 1 : 0.22),
        offset({ x: point[0] * width - 3, y: point[1] * height - 3 }),
      ]}
    />
  ));

  return (
    <VStack
      alignment="leading"
      spacing={2}
      modifiers={[
        containerBackground('#070A1C', 'widget'),
        widgetURL('mindfree://'),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      ]}>
      <ZStack
        alignment="topLeading"
        modifiers={[frame({ width, height, alignment: 'topLeading' }), accessibilityHidden(true)]}>
        {lines}
        {stars}
        <Image
          systemName="moon.fill"
          size={15}
          color="#C7B8FF"
          modifiers={[offset({ x: width - 12, y: -6 })]}
        />
      </ZStack>
      <Spacer />
      <Text modifiers={[font({ size: 15, weight: 'heavy', design: 'rounded' }), foregroundStyle('#EEF0FF')]}>
        {props.title}
      </Text>
      <Text
        modifiers={[
          font({ size: 13, weight: 'bold', design: 'rounded' }),
          foregroundStyle('#C9CDEB'),
          lineLimit(2),
          minimumScaleFactor(0.85),
        ]}>
        {caption}
      </Text>
    </VStack>
  );
};

export const SkyWidget = createWidget<SkyWidgetProps>('SeuCeu', SkyLayout, {
  mode: 'dia',
  stars: 0,
  title: 'Seu céu',
  caption: 'Sua 1ª estrela acende hoje à noite',
  litTonight: false,
});
