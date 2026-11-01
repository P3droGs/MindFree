import { usePathname, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Line, Path, Polyline } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { useT } from '@/i18n';
import { fonts } from '@/theme/typography';

/**
 * O "observatório": a parte social tem um céu fixo, igual no claro e no escuro,
 * para ser reconhecida na hora (e para as fotos e estrelas sempre aparecerem bem).
 */
export const OBS = {
  background: '#0B0E24',
  card: '#121636',
  cardBorder: '#222861',
  cardMine: '#1A1F4D',
  cardMineBorder: '#3A4080',
  raised: '#242A57',
  track: '#2C3370',
  line: '#2A3060',
  text: '#EEF0FF',
  soft: '#C9CDEB',
  muted: '#A9AED6',
  faint: '#8C92C4',
  gold: '#FFC857',
  goldText: '#FFE7A8',
  lilac: '#B9A6FF',
  lilacText: '#D6CCFF',
  ink: '#10142E',
  ringOff: '#4A4F8C',
  danger: '#FF9B8F',
} as const;

/** A estrelinha de quatro pontas do brilho. */
export const SPARKLE_PATH = 'M12 2 C 13 8, 16 11, 22 12 C 16 13, 13 16, 12 22 C 11 16, 8 13, 2 12 C 8 11, 11 8, 12 2 Z';

export function Sparkle({ size = 14, color = OBS.goldText }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SPARKLE_PATH} fill={color} />
    </Svg>
  );
}

type DockTab = 'amigos' | 'mural' | 'orbita' | 'perfil';

type ObservatoryScreenProps = {
  children: ReactNode;
  /** Mostra a barra flutuante com Céu, Mural, Postar, Órbita e Perfil. */
  dock?: boolean;
  /** Aviso curto ("Brilho enviado…"), que flutua logo acima da barra para não ficar escondido atrás dela. */
  toast?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /** Conteúdo encostado no topo (o perfil desenha o próprio céu atrás da área segura). */
  edgeToEdge?: boolean;
};

const DOCK_HEIGHT = 66;
const TOAST_MS = 3500;

/** Distância da barra até o pé da tela. */
function dockBottom(insets: EdgeInsets) {
  return Math.max(insets.bottom, 12) + 8;
}

/** Se o teclado está aberto, e a altura dele. */
function useKeyboard() {
  const [keyboard, setKeyboard] = useState(() => ({ open: Keyboard.isVisible(), height: Keyboard.metrics()?.height ?? 0 }));
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboard({ open: true, height: event.endCoordinates.height }));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard({ open: false, height: 0 }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboard;
}

/** O aviso das telas sociais: some sozinho depois de alguns segundos. */
export function useObsToast(): [string, (text: string) => void] {
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(text);
    if (text) timer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);
  return [toast, show];
}

export function ObservatoryScreen({ children, dock = true, toast = '', contentStyle, edgeToEdge }: ObservatoryScreenProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();
  // Com o teclado aberto, a tela do Android encolhe e a barra subiria junto, cobrindo o que se digita.
  const showDock = dock && !keyboard.open;
  let toastBottom = dockBottom(insets) + (showDock ? DOCK_HEIGHT + 12 : 0);
  // No iPhone a tela não encolhe: o aviso sobe por cima do teclado.
  if (keyboard.open) toastBottom = (Platform.OS === 'ios' ? keyboard.height : 0) + 12;
  return (
    <SafeAreaView edges={edgeToEdge ? ['bottom'] : ['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, edgeToEdge && styles.edgeToEdge, dock && styles.withDock, contentStyle]}>
        {children}
      </ScrollView>
      {showDock ? <SocialDock /> : null}
      {toast ? (
        <View pointerEvents="none" style={[styles.toastSpot, { bottom: toastBottom }]}>
          <ObsToast text={toast} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const TABS: { tab: DockTab; href: Href; label: 'social.tabSky' | 'social.tabMural' | 'social.tabOrbit' | 'social.tabProfile' }[] = [
  { tab: 'amigos', href: '/amigos', label: 'social.tabSky' },
  { tab: 'mural', href: '/mural', label: 'social.tabMural' },
  { tab: 'orbita', href: '/orbita', label: 'social.tabOrbit' },
  { tab: 'perfil', href: '/perfil', label: 'social.tabProfile' },
];

/** A barra flutuante do observatório, com o botão dourado de postar no meio. */
function SocialDock() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const t = useT();
  const items = TABS.map((item) => ({ ...item, active: pathname === `/${item.tab}` }));
  const renderItem = (item: (typeof items)[number]) => (
    <Pressable
      key={item.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: item.active }}
      onPress={() => {
        // Se a aba já está mais atrás (Perfil → Órbita → Perfil), volta até ela em vez de empilhar outra igual;
        // trocar por cima deixava duas telas iguais, e o voltar parecia não funcionar.
        if (!item.active) router.dismissTo(item.href);
      }}
      style={({ pressed }) => [styles.dockItem, { opacity: pressed ? 0.7 : 1 }]}>
      <DockIcon tab={item.tab} color={item.active ? OBS.text : OBS.faint} />
      <AppText variant="caption" style={[styles.dockLabel, { color: item.active ? OBS.text : OBS.faint }]}>
        {t(item.label)}
      </AppText>
      <View style={[styles.dockDot, item.active && { backgroundColor: OBS.gold }]} />
    </Pressable>
  );

  return (
    <View accessibilityRole="tablist" style={[styles.dock, { bottom: dockBottom(insets) }]}>
      {items.slice(0, 2).map(renderItem)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('post.title')}
        onPress={() => router.push('/postar')}
        style={({ pressed }) => [styles.post, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
        <Sparkle size={26} color={OBS.ink} />
      </Pressable>
      {items.slice(2).map(renderItem)}
    </View>
  );
}

function DockIcon({ tab, color }: { tab: DockTab; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {tab === 'amigos' ? (
        <>
          <Polyline points="3 17 8 9 13 13 20 5" {...stroke} />
          <Circle cx={3} cy={17} r={1.6} fill={color} />
          <Circle cx={8} cy={9} r={1.6} fill={color} />
          <Circle cx={13} cy={13} r={1.6} fill={color} />
          <Circle cx={20} cy={5} r={1.6} fill={color} />
        </>
      ) : tab === 'mural' ? (
        <>
          <Path d="M4 20 V10 a8 8 0 0 1 16 0 V20 Z" {...stroke} />
          <Line x1={4} y1={15} x2={20} y2={15} {...stroke} />
        </>
      ) : tab === 'orbita' ? (
        <>
          <Circle cx={12} cy={12} r={5} {...stroke} />
          <Ellipse cx={12} cy={12} rx={10} ry={4.5} transform="rotate(-20 12 12)" {...stroke} />
        </>
      ) : (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21 a8 8 0 0 1 16 0" {...stroke} />
        </>
      )}
    </Svg>
  );
}

/** Botãozinho redondo do observatório (Brilho, Cutucar, Seguir…). */
export function ObsChip({
  label,
  onPress,
  filled,
  gold,
  icon,
  accessibilityLabel,
  selected,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  gold?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  selected?: boolean;
}) {
  const background = gold ? OBS.gold : filled ? OBS.lilac : 'transparent';
  const color = gold || filled ? OBS.ink : OBS.goldText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, borderColor: gold || filled ? background : '#353C78', opacity: pressed ? 0.75 : 1 },
      ]}>
      {icon}
      <AppText variant="caption" style={[styles.chipText, { color }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ObsToast({ text }: { text: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.toast}>
      <AppText variant="small" style={{ color: OBS.text }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: OBS.background },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 18 },
  edgeToEdge: { paddingHorizontal: 0, paddingTop: 0 },
  withDock: { paddingBottom: 130 },
  dock: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: DOCK_HEIGHT,
    borderRadius: 28,
    backgroundColor: 'rgba(20, 25, 60, 0.96)',
    borderWidth: 1,
    borderColor: '#2F3670',
    boxShadow: '0px 20px 44px -16px rgba(0, 0, 0, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dockItem: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dockLabel: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14 },
  dockDot: { width: 4, height: 4, borderRadius: 2 },
  post: {
    width: 58,
    height: 58,
    marginTop: -30,
    marginHorizontal: 4,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OBS.gold,
    experimental_backgroundImage: 'linear-gradient(160deg, #FFE7A8 0%, #FFC857 45%, #B9A6FF 100%)',
    boxShadow: '0px 10px 24px -8px rgba(255, 200, 87, 0.7)',
  },
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.extraBold, fontSize: 13, lineHeight: 18 },
  toastSpot: { position: 'absolute', left: 20, right: 20 },
  toast: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: OBS.raised,
    borderWidth: 1,
    borderColor: '#353C78',
    boxShadow: '0px 12px 28px -12px rgba(0, 0, 0, 0.85)',
  },
});
