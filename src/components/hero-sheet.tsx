import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NightIllustration } from '@/components/night-illustration';
import { useAppTheme } from '@/theme/theme-provider';

type HeroSheetProps = {
  heroHeight: number;
  /** O que fica por cima da ilustração (o voltar). Fica parado no topo enquanto a tela rola. */
  overlay?: ReactNode;
  children: ReactNode;
};

/** Ilustração da noite em cima e um painel arredondado por cima dela, como nas telas de entrar. */
export function HeroSheet({ heroHeight, overlay, children }: HeroSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: theme.surface }]}>
      {/* A ilustração é sempre noturna, então a barra de status fica clara. */}
      <StatusBar style="light" />
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <View style={{ height: heroHeight }}>
          <NightIllustration height={heroHeight} />
        </View>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + 24,
              boxShadow: '0px -18px 40px -20px rgba(0, 0, 0, 0.6)',
            },
          ]}>
          {children}
        </View>
      </ScrollView>
      {/* Fora da rolagem: o voltar fica sempre no topo, mesmo com a tela rolada (em vez de sumir sob o relógio). */}
      {overlay ? (
        <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 8 }]}>
          {overlay}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  overlay: { position: 'absolute', left: 16, right: 16 },
  sheet: {
    flexGrow: 1,
    marginTop: -34,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    gap: 16,
  },
});
