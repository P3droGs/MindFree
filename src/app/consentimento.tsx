import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { useT } from '@/i18n';
import { CONSENT_VERSION } from '@/lib/consent';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';
import { withAlpha } from '@/theme/color';

/**
 * Antes da primeira gravação: o que sai do celular, para quem e para quê, e o "Concordo".
 * Exigido pela App Store (5.1.2(i), IA de terceiros) e pela LGPD (consentimento destacado,
 * com aviso da transferência para fora do Brasil). Recusar não trava o app.
 */
export default function ConsentScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { update } = useSettings();
  const params = useLocalSearchParams<{ next?: string }>();
  // Só estes destinos: o endereço da tela não escolhe para onde o app vai.
  const next = params.next === 'gravar' || params.next === 'escrever' ? params.next : null;

  const goOn = () => {
    if (next) router.replace(next === 'gravar' ? '/gravar' : '/escrever');
    else router.back();
  };

  const accept = () => {
    update({ aiConsent: 'granted', aiConsentAt: Date.now(), aiConsentVersion: CONSENT_VERSION });
    goOn();
  };

  const decline = () => {
    update({ aiConsent: 'declined', aiConsentAt: Date.now() });
    goOn();
  };

  return (
    <Screen>
      {/* Voltar à esquerda, como nas outras telas (o X à direita ficava embaixo de outros botões). */}
      <BackButton onPress={() => router.back()} style={styles.back} />

      <View style={styles.flow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FlowStep icon="mic" label={t('consent.flowVoice')} />
        <View style={[styles.dash, { borderColor: theme.border }]} />
        <FlowStep icon="edit" label={t('consent.flowText')} />
        <View style={[styles.dash, { borderColor: theme.border }]} />
        <FlowStep icon="checklist" label={t('consent.flowTasks')} />
      </View>

      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('consent.title')}
        </AppText>
        <AppText tone="secondary">{t('consent.intro')}</AppText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.cardShadow }]}>
        <Point icon="mic" title={t('consent.whatTitle')} body={t('consent.whatBody')} />
        <Point icon="globe" title={t('consent.whoTitle')} body={t('consent.whoBody')} />
        <Point icon="lock" title={t('consent.rulesTitle')} body={t('consent.rulesBody')} />
        <Point icon="eye-off" title={t('consent.tipTitle')} body={t('consent.tipBody')} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={t('consent.accept')} onPress={accept} />
        <LinkButton label={t('consent.decline')} align="center" onPress={decline} />
        <AppText variant="caption" tone="secondary" style={styles.center}>
          {t('consent.declineHint')}
        </AppText>
        <LinkButton label={t('consent.policy')} align="center" tone="primary" onPress={() => router.push('/privacidade')} />
      </View>
    </Screen>
  );
}

function FlowStep({ icon, label }: { icon: IconName; label: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, { backgroundColor: withAlpha(theme.accent, 0.16) }]}>
        <Icon name={icon} size={24} color={theme.accentStrong} strokeWidth={2.2} />
      </View>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </View>
  );
}

function Point({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.point}>
      <Icon name={icon} size={20} color={theme.accentStrong} strokeWidth={2.2} />
      <View style={styles.pointText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" tone="secondary">
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  flow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  step: { alignItems: 'center', gap: 6, width: 72 },
  stepIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dash: { flex: 1, maxWidth: 40, borderTopWidth: 2, borderStyle: 'dashed', marginBottom: 22 },
  intro: { gap: 8 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 16 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointText: { flex: 1, gap: 2 },
  actions: { gap: 6 },
  center: { textAlign: 'center' },
});
