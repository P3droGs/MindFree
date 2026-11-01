import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Mask,
  Path,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { fonts } from '@/theme/typography';

const SKY_STARS = [
  { cx: 28, cy: 42, r: 1.4, o: 0.7 },
  { cx: 96, cy: 88, r: 1, o: 0.5 },
  { cx: 150, cy: 30, r: 1.6, o: 0.75 },
  { cx: 214, cy: 74, r: 1.1, o: 0.55 },
  { cx: 246, cy: 22, r: 1.3, o: 0.6 },
  { cx: 392, cy: 164, r: 1.2, o: 0.5 },
  { cx: 20, cy: 190, r: 1.2, o: 0.45 },
  { cx: 190, cy: 140, r: 1, o: 0.4 },
  { cx: 372, cy: 232, r: 1.4, o: 0.5 },
];

const SPARKLE = 'M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7 Z';
const MIC_PATHS = ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'M19 10v2a7 7 0 0 1-14 0v-2'];

/**
 * A noite do MindFree: lua, estrelas, um cartão de tarefas e o microfone.
 * Decorativa: o leitor de tela pula. Fica ancorada embaixo e corta o céu quando falta altura.
 */
export function NightIllustration({ height }: { height: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.container, { height }]}>
      <Svg width="100%" height="100%" viewBox="0 0 412 400" preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="mf-ceu" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#262D72" />
            <Stop offset="0.65" stopColor="#161B45" />
            <Stop offset="1" stopColor="#10142E" />
          </LinearGradient>
          <RadialGradient id="mf-luar" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#C7B8FF" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#C7B8FF" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="mf-cartao" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#ECE6FF" />
          </LinearGradient>
          <LinearGradient id="mf-microfone" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#D3C7FF" />
            <Stop offset="1" stopColor="#9F86FF" />
          </LinearGradient>
          <Mask id="mf-crescente">
            <Rect x="0" y="0" width="412" height="400" fill="#FFFFFF" />
            <Circle cx="342" cy="76" r="36" fill="#000000" />
          </Mask>
        </Defs>

        <Rect x="0" y="0" width="412" height="400" fill="url(#mf-ceu)" />
        {SKY_STARS.map((star) => (
          <Circle key={`${star.cx}-${star.cy}`} cx={star.cx} cy={star.cy} r={star.r} fill="#EEF0FF" opacity={star.o} />
        ))}
        <Path d={SPARKLE} transform="translate(60 147)" fill="#FFF4D6" />
        <Path d={SPARKLE} transform="translate(232 118) scale(0.85)" fill="#FFF4D6" opacity={0.85} />
        <Path d={SPARKLE} transform="translate(384 114) scale(0.85)" fill="#FFF4D6" opacity={0.7} />

        <Circle cx="322" cy="92" r="96" fill="url(#mf-luar)" opacity={0.75} />
        <Circle cx="322" cy="92" r="42" fill="#E4DBFF" mask="url(#mf-crescente)" />
        <SvgText x="262" y="78" fontFamily={fonts.extraBold} fontSize="15" fill="#C7B8FF" opacity={0.75}>
          z
        </SvgText>
        <SvgText x="276" y="58" fontFamily={fonts.extraBold} fontSize="20" fill="#C7B8FF" opacity={0.9}>
          z
        </SvgText>

        <G fill="#2A3275" opacity={0.55}>
          <Circle cx="262" cy="150" r="16" />
          <Circle cx="284" cy="140" r="22" />
          <Circle cx="310" cy="150" r="17" />
          <Rect x="246" y="150" width="82" height="16" rx="8" />
        </G>

        <Path d="M0 292 C 60 262, 120 270, 176 288 S 290 252, 348 270 S 404 292, 412 284 V400 H0 Z" fill="#1C225B" />
        <Path d="M0 330 C 74 302, 150 318, 214 334 S 336 300, 412 320 V400 H0 Z" fill="#151A44" />

        <Ellipse cx="146" cy="300" rx="64" ry="8" fill="#0A0D24" opacity={0.45} />
        <G transform="translate(70 156) rotate(-7)">
          <Rect x="0" y="0" width="160" height="112" rx="20" fill="url(#mf-cartao)" />
          <Circle cx="26" cy="30" r="9" fill="#8F78F0" />
          <Polyline points="21.5 30 24.8 33.2 30.5 27" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="44" y="26" width="92" height="8" rx="4" fill="#D9D1F7" />
          <Circle cx="26" cy="58" r="9" fill="#8F78F0" />
          <Polyline points="21.5 58 24.8 61.2 30.5 55" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="44" y="54" width="74" height="8" rx="4" fill="#D9D1F7" />
          <Circle cx="26" cy="86" r="8" fill="none" stroke="#8F78F0" strokeWidth="2.4" />
          <Rect x="44" y="82" width="98" height="8" rx="4" fill="#B9AEE8" />
        </G>

        <Path
          d="M228 272 C 208 258, 216 232, 238 226"
          fill="none"
          stroke="#C7B8FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 7"
          opacity={0.8}
        />

        <G transform="translate(264 290)">
          <Circle cx="0" cy="0" r="50" fill="#B9A6FF" opacity={0.12} />
          <Path d="M-58 -12 C -64 -4, -64 4, -58 12" fill="none" stroke="#C7B8FF" strokeWidth="2.4" strokeLinecap="round" opacity={0.6} />
          <Path d="M-68 -20 C -78 -7, -78 7, -68 20" fill="none" stroke="#C7B8FF" strokeWidth="2.4" strokeLinecap="round" opacity={0.35} />
          <Path d="M58 -12 C 64 -4, 64 4, 58 12" fill="none" stroke="#C7B8FF" strokeWidth="2.4" strokeLinecap="round" opacity={0.6} />
          <Path d="M68 -20 C 78 -7, 78 7, 68 20" fill="none" stroke="#C7B8FF" strokeWidth="2.4" strokeLinecap="round" opacity={0.35} />
          <Circle cx="0" cy="0" r="36" fill="url(#mf-microfone)" />
          <G transform="translate(-15 -15) scale(1.25)" fill="none" stroke="#10142E" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            {MIC_PATHS.map((d) => (
              <Path key={d} d={d} />
            ))}
            <Line x1="12" y1="19" x2="12" y2="23" />
            <Line x1="8" y1="23" x2="16" y2="23" />
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', backgroundColor: '#10142E' },
});
