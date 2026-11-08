import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, PrimaryButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { useI18n, type MessageKey } from '@/i18n';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

const FEATURES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: 'mic', title: 'plus.feature1Title', body: 'plus.feature1Body' },
  { icon: 'search', title: 'plus.feature2Title', body: 'plus.feature2Body' },
];

/**
 * O MindFree Plus, antes de existir: o que a assinatura vai trazer, o que continua grátis e um botão para a
 * pessoa dizer que quer saber quando chegar. Sem preço nem compra: isso vem com a loja, quando for a hora.
 */
export default function PlusScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useI18n();
  const { settings, update } = useSettings();

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <View style={styles.titleRow}>
          <AppText variant="title" accessibilityRole="header">
            {t('plus.title')}
          </AppText>
          <View style={[styles.pill, { backgroundColor: theme.accent }]}>
            <AppText variant="small" style={{ color: theme.onAccent }}>
              {t('plus.soon')}
            </AppText>
          </View>
        </View>
        <AppText tone="secondary">{t('plus.intro')}</AppText>
      </View>
      {FEATURES.map((feature) => (
        <Card key={feature.title} style={styles.feature}>
          <View style={[styles.featureIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name={feature.icon} size={22} color={theme.accent} />
          </View>
          <View style={styles.featureText}>
            <AppText variant="bodyStrong">{t(feature.title)}</AppText>
            <AppText variant="small" tone="secondary">
              {t(feature.body)}
            </AppText>
          </View>
        </Card>
      ))}
      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {t('plus.freeTitle')}
        </AppText>
        <AppText variant="small" tone="secondary">
          {t('plus.freeBody')}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {t('plus.noCharge')}
        </AppText>
      </View>
      {settings.plusInterest ? (
        <View style={[styles.notified, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Icon name="check" size={18} color={theme.accent} strokeWidth={2.6} />
          <AppText variant="bodyStrong" tone="accent">
            {t('plus.notified')}
          </AppText>
        </View>
      ) : (
        <PrimaryButton label={t('plus.notify')} icon="bell" onPress={() => update({ plusInterest: true })} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  featureText: { flex: 1, gap: 4 },
  section: { gap: 8 },
  notified: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
});
