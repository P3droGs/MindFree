import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { LinkButton, PrimaryButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { Screen, Spacer } from '@/components/screen';
import { useClock } from '@/hooks/use-now';
import { useI18n } from '@/i18n';
import { captureOrganized, captureText, captureVoice, pendingNight } from '@/lib/capture';
import { clearCapture, peekCapture } from '@/lib/capture-handoff';
import { aiAllowed } from '@/lib/consent';
import { aiConfigured, organizeOnServer, QuotaError } from '@/lib/organize';
import { formatMinutes } from '@/lib/time';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';

type Outcome =
  | { phase: 'working' }
  | { phase: 'done'; noted: number; example: boolean; localOnly?: boolean; ai?: boolean }
  | { phase: 'failed'; quota: boolean }
  | { phase: 'noAudio' };

/**
 * Depois de gravar ou escrever: organiza com a IA (servidor) e mostra "Anotado!", a estrela nova e o boa noite.
 * Sem internet, a gravação pode ficar guardada para organizar depois.
 */
export default function SavedScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, language } = useI18n();
  const { settings } = useSettings();
  const { change } = useJournal();
  const clock = useClock();
  // Só o que o próprio app gravou ou escreveu agora (nunca o que vem num link).
  const [input] = useState(peekCapture);
  const voice = input?.via === 'voz';
  const audioUri = input?.via === 'voz' ? input.audioUri : null;
  const text = input?.via === 'texto' ? input.text : '';
  const [outcome, setOutcome] = useState<Outcome>({ phase: 'working' });
  const started = useRef(false);
  // O momento da noite fica fixo, mesmo que organizar demore ou a pessoa tente de novo.
  const moment = useRef<Date | null>(null);

  const organize = async () => {
    // A gravação não gerou arquivo (o microfone falhou): não há o que organizar nem guardar.
    // Sem isto, nascia uma noite pendente sem áudio, que nunca seria organizada: uma estrela vazia para sempre.
    if (voice && !audioUri) {
      setOutcome({ phase: 'noAudio' });
      return;
    }
    moment.current ??= clock();
    const now = moment.current;
    const morning = settings.morningMinutes;
    const useAi = aiAllowed(settings);

    if (!voice) {
      // Texto: com a IA quando dá; sem internet, o organizador do próprio celular resolve.
      try {
        if (!useAi) throw new Error('sem IA');
        const result = await organizeOnServer({ text }, now, morning, language.code);
        change((current) => captureOrganized(current, { ...result, transcript: text }, { via: 'texto' }, now, morning).journal);
        setOutcome({ phase: 'done', noted: result.tasks.length, example: false, ai: true });
      } catch {
        const local = captureText({ tasks: [], nights: [] }, text, now, morning).noted;
        change((current) => captureText(current, text, now, morning).journal);
        setOutcome({ phase: 'done', noted: local, example: false });
      }
      return;
    }

    if (!aiConfigured) {
      change((current) => captureVoice(current, audioUri, now, morning, t).journal);
      setOutcome({ phase: 'done', noted: 4, example: true });
      return;
    }

    // Sem o "Concordo", a gravação fica só no celular. Se a IA for ligada depois, dá para organizar.
    if (!useAi) {
      change((current) => pendingNight(current, audioUri, now, morning));
      setOutcome({ phase: 'done', noted: 0, example: false, localOnly: true });
      return;
    }

    try {
      if (!audioUri) throw new Error('sem gravação');
      const result = await organizeOnServer({ audioUri }, now, morning, language.code);
      change((current) => captureOrganized(current, result, { via: 'voz', audioUri }, now, morning).journal);
      setOutcome({ phase: 'done', noted: result.tasks.length, example: false, ai: true });
    } catch (error) {
      setOutcome({ phase: 'failed', quota: error instanceof QuotaError });
    }
  };

  useEffect(() => {
    if (started.current || !input) return;
    started.current = true;
    clearCapture();
    void organize();
    // Organiza uma vez só, quando a tela abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Volta para o início que já está embaixo. Trocar esta tela por um início novo deixava dois na pilha,
  // e o voltar do Android (ou o gesto do iPhone) caía no início de novo em vez de sair.
  const goHome = () => router.dismissTo('/');

  const retry = () => {
    setOutcome({ phase: 'working' });
    void organize();
  };

  const keepForLater = () => {
    const now = moment.current ?? clock();
    change((current) => pendingNight(current, audioUri, now, settings.morningMinutes));
    goHome();
  };

  // Aberta por um link de fora ou depois de recarregar o app: não há nada para organizar.
  if (!input) return <Redirect href="/" />;

  if (outcome.phase === 'working') {
    return (
      <Screen scrollEnabled={false} contentStyle={styles.centered}>
        <ActivityIndicator size="large" color={theme.accent} />
        <AppText variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
          {t('saved.saving')}
        </AppText>
        <AppText tone="secondary" style={styles.center}>
          {t('saved.savingSub')}
        </AppText>
      </Screen>
    );
  }

  if (outcome.phase === 'noAudio') {
    return (
      <Screen scrollEnabled={false}>
        <Spacer />
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: theme.raised }]}>
            <Icon name="mic" size={40} color={theme.accentStrong} strokeWidth={2.3} />
          </View>
          <AppText variant="title" accessibilityRole="header" style={styles.center}>
            {t('record.errorTitle')}
          </AppText>
          <AppText tone="secondary" style={styles.center}>
            {t('record.errorBody')}
          </AppText>
        </View>
        <Spacer />
        <View style={styles.actions}>
          <PrimaryButton label={t('saved.retryRecording')} icon="mic" onPress={() => router.replace('/gravar')} />
          <LinkButton label={t('common.back')} align="center" onPress={goHome} />
        </View>
      </Screen>
    );
  }

  if (outcome.phase === 'failed') {
    // Sem internet: tentar de novo. No limite do dia: guardar e organizar amanhã.
    const quota = outcome.quota;
    return (
      <Screen scrollEnabled={false}>
        <Spacer />
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: theme.raised }]}>
            <Icon name="mic" size={40} color={theme.accentStrong} strokeWidth={2.3} />
          </View>
          <AppText variant="title" accessibilityRole="header" style={styles.center}>
            {quota ? t('saved.quotaTitle') : t('saved.failedTitle')}
          </AppText>
          <AppText tone="secondary" style={styles.center}>
            {quota ? t('saved.quotaBody') : t('saved.failedBody')}
          </AppText>
        </View>
        <Spacer />
        <View style={styles.actions}>
          {quota ? (
            <PrimaryButton label={t('saved.later')} onPress={keepForLater} />
          ) : (
            <>
              <PrimaryButton label={t('saved.retry')} onPress={retry} />
              <LinkButton label={t('saved.later')} align="center" onPress={keepForLater} />
            </>
          )}
        </View>
      </Screen>
    );
  }

  const { noted, example, localOnly, ai } = outcome;
  let count = t('saved.countMany', { n: noted });
  if (noted === 0) count = t('saved.countZero');
  if (noted === 1) count = t('saved.countOne');
  if (localOnly) count = t('saved.localOnly');

  return (
    <Screen scrollEnabled={false}>
      <Spacer />
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: theme.accent, boxShadow: theme.accentGlow }]}>
          <Icon name="check" size={44} color={theme.onAccent} strokeWidth={3} />
        </View>
        <AppText variant="display" accessibilityRole="header" style={styles.center}>
          {t('saved.title')}
        </AppText>
        <AppText variant="heading" style={styles.center}>
          {count}
        </AppText>
        <AppText tone="secondary" style={styles.center}>
          {localOnly ? t('saved.localHint') : t('saved.morning', { time: formatMinutes(settings.morningMinutes) })}
        </AppText>
        {example ? (
          <AppText variant="caption" tone="secondary" style={styles.center}>
            {t('saved.exampleNote')}
          </AppText>
        ) : null}
        {ai && noted > 0 ? (
          <AppText variant="caption" tone="secondary" style={styles.center}>
            {t('saved.aiNote')}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ceu')}
          style={({ pressed }) => [styles.star, { borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}>
          <Svg width={22} height={22} viewBox="-12 -12 24 24">
            <Circle r={10} fill="#FFF4D6" opacity={0.18} />
            <Path d="M0 -8 C1 -2 2 -1 8 0 C2 1 1 2 0 8 C-1 2 -2 1 -8 0 C-2 -1 -1 -2 0 -8 Z" fill="#FFF4D6" />
          </Svg>
          <AppText variant="bodyStrong" tone="accent">
            {t('saved.newStar')}
          </AppText>
        </Pressable>
      </View>
      <Spacer />
      <View style={styles.actions}>
        <PrimaryButton label={t('saved.goodNight')} icon="moon" onPress={goHome} />
        <LinkButton label={t('saved.oneMore')} align="center" onPress={() => router.replace('/gravar')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  body: { alignItems: 'center', gap: 12 },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  center: { textAlign: 'center' },
  star: {
    marginTop: 8,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  actions: { gap: 6 },
});
