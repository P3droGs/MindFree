import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme-provider';

type ScreenProps = {
  children: ReactNode;
  scrollEnabled?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Tela padrão: área segura, fundo do tema e rolagem quando o conteúdo não cabe. */
export function Screen({ children, scrollEnabled = true, contentStyle }: ScreenProps) {
  const theme = useAppTheme();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* No iPhone, abre espaço para o teclado e rola até o campo em uso (no Android o sistema já faz isso). */}
      <ScrollView
        scrollEnabled={scrollEnabled}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, contentStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Empurra o que vem depois para o fim da tela. */
export function Spacer() {
  return <View style={styles.spacer} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 20 },
  spacer: { flexGrow: 1 },
});
