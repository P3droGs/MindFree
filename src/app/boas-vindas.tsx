import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BrandMark } from '@/components/brand-mark';
import { LinkButton, PrimaryButton } from '@/components/buttons';
import { Icon, type IconName } from '@/components/icon';
import { LanguageButton, LanguageSheet } from '@/components/language-sheet';
import { NightIllustration } from '@/components/night-illustration';
import { ProgressDots } from '@/components/progress-dots';
import { useT, type MessageKey } from '@/i18n';
import { useAppTheme } from '@/theme/theme-provider';

const STEPS: { icon: IconName; label: MessageKey; sunny?: boolean }[] = [
  { icon: 'mic', label: 'welcome.step1' },
  { icon: 'checklist', label: 'welcome.step2' },
  { icon: 'sun', label: 'welcome.step3', sunny: true },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const heroHeight = Math.round(Math.min(height * 0.46, 420));

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={{ height: heroHeight }}>
          <NightIllustration height={heroHeight} />
          <View style={[styles.overlay, { top: insets.top + 8 }]}>
            <BrandMark />
            <LanguageButton onPress={() => setLanguagesOpen(true)} />
          </View>
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.intro}>
            <AppText variant="display" accessibilityRole="header">
              {t('welcome.title1')}
              {'\n'}
              <AppText variant="display" tone="accent">
                {t('welcome.title2')}
              </AppText>
            </AppText>
            <AppText tone="secondary">{t('welcome.sub')}</AppText>
          </View>

          <View accessibilityLabel={t('welcome.how')} style={styles.steps}>
            {STEPS.map((step) => (
              <View
                key={step.label}
                style={[styles.step, { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.cardShadow }]}>
                <View style={[styles.stepIcon, { backgroundColor: step.sunny ? '#3A2F22' : theme.raised }]}>
                  <Icon name={step.icon} size={17} color={step.sunny ? '#FFC857' : theme.accentStrong} strokeWidth={2.2} />
                </View>
                <AppText variant="bodyStrong" style={styles.stepLabel}>
                  {t(step.label)}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.spacer} />

          <View style={styles.footer}>
            {/* Conta é opcional: começa direto e, se quiser, cria uma depois em Ajustes.
                Nome, cor e fundo ficam só em Ajustes; o primeiro uso pede apenas os horários. */}
            <PrimaryButton label={t('welcome.start')} onPress={() => router.push('/horarios')} />
            <AppText variant="caption" tone="secondary" style={styles.center}>
              {t('welcome.noAccount')}
            </AppText>
            <LinkButton label={t('welcome.haveAccount')} align="center" onPress={() => router.push('/entrar')} />
            <ProgressDots total={2} current={0} />
          </View>
        </View>
      </ScrollView>

      <LanguageSheet visible={languagesOpen} onClose={() => setLanguagesOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  overlay: {
    position: 'absolute',
    left: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, gap: 20 },
  intro: { gap: 10 },
  steps: { flexDirection: 'row', gap: 8 },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  stepIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 14, lineHeight: 19, textAlign: 'center' },
  spacer: { flexGrow: 1 },
  footer: { gap: 4 },
  center: { textAlign: 'center' },
});
