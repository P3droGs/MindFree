import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, BackHandler, Linking, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { Screen, Spacer } from '@/components/screen';
import { useT } from '@/i18n';
import { handOffCapture } from '@/lib/capture-handoff';
import { deleteLocalFile } from '@/lib/files';
import { useAppTheme } from '@/theme/theme-provider';

const GOAL_SECONDS = 60;
const MAX_SECONDS = 180;
const RING = 116;
const BARS = 14;
/** A partir daqui, voltar pergunta antes de apagar o que já foi falado. */
const CONFIRM_AFTER_SECONDS = 3;

export default function RecordScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, directory: 'document' });
  const state = useAudioRecorderState(recorder, 120);
  const finishing = useRef(false);
  const seconds = Math.floor(state.durationMillis / 1000);

  // Pede o microfone e começa a gravar assim que a tela abre.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        Alert.alert(t('record.deniedTitle'), t('record.deniedBody'), [
          { text: t('common.back'), style: 'cancel', onPress: () => router.back() },
          { text: t('settings.openSettings'), onPress: () => { void Linking.openSettings(); router.back(); } },
        ]);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      // Se a pessoa já voltou enquanto o microfone ligava, não começa a gravar.
      if (!cancelled && !finishing.current) recorder.record();
    })().catch(() => {
      Alert.alert(t('record.errorTitle'), t('record.errorBody'), [{ text: t('common.back'), onPress: () => router.back() }]);
    });
    return () => {
      cancelled = true;
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    };
  }, [recorder, router, t]);

  // As barrinhas sobem com a voz (o volume vem em decibéis, de -160 a 0) e ondulam com o tempo.
  const volume =
    !state.isRecording ? 0.15 : state.metering === undefined ? 0.3 : Math.min(Math.max((state.metering + 55) / 50, 0.08), 1);
  const levels = Array.from({ length: BARS }, (_, index) =>
    Math.max(0.12, volume * (0.55 + 0.45 * Math.abs(Math.sin(state.durationMillis / 180 + index * 0.9)))),
  );

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    await recorder.stop().catch(() => undefined);
    // O "Anotado!" manda a gravação para organizar e mostra o resultado.
    handOffCapture({ via: 'voz', audioUri: recorder.uri });
    router.replace('/anotado');
  };

  const cancel = async () => {
    // Já está salvando (tocou em Pronto): não apaga a gravação no meio do caminho.
    if (finishing.current) return;
    finishing.current = true;
    await recorder.stop().catch(() => undefined);
    // Cancelou: a gravação não fica esquecida no celular.
    if (recorder.uri) deleteLocalFile(recorder.uri);
    router.back();
  };

  // A seta do topo e o voltar do Android: com quase nada gravado, só cancela; com mais, confirma antes.
  const leave = () => {
    if (finishing.current) return;
    if (seconds < CONFIRM_AFTER_SECONDS) {
      void cancel();
      return;
    }
    Alert.alert(t('record.discardTitle'), t('record.discardBody'), [
      { text: t('record.keepRecording'), style: 'cancel' },
      { text: t('record.discard'), style: 'destructive', onPress: () => void cancel() },
    ]);
  };
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (seconds >= MAX_SECONDS) void finish();
    // `finish` muda a cada render; o que importa é chegar ao tempo máximo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const progress = Math.min(seconds / GOAL_SECONDS, 1);
  const circumference = 2 * Math.PI * RING;
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const phase = seconds >= MAX_SECONDS ? 'max' : seconds >= GOAL_SECONDS ? 'goal' : 'before';

  return (
    <Screen scrollEnabled={false}>
      <BackButton onPress={leave} style={styles.back} />
      <View style={styles.header}>
        <View style={styles.listening}>
          <View style={[styles.liveDot, { backgroundColor: theme.danger }]} />
          <AppText variant="title" accessibilityRole="header">
            {t('record.listening')}
          </AppText>
        </View>
        <AppText tone="secondary">{t('record.pauses')}</AppText>
      </View>

      <View style={styles.ringArea}>
        <Svg width={260} height={260} viewBox="0 0 260 260">
          <Circle cx={130} cy={130} r={RING} stroke={theme.raised} strokeWidth={10} fill="none" />
          <Circle
            cx={130}
            cy={130}
            r={RING}
            stroke={theme.accent}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 130 130)"
          />
        </Svg>
        <View style={styles.ringText} accessible accessibilityLiveRegion="polite" accessibilityLabel={clock}>
          <AppText variant="time" style={styles.clock}>
            {clock}
          </AppText>
          <AppText variant="small" tone={phase === 'before' ? 'secondary' : 'accent'}>
            {phase === 'before' ? t('record.goal') : phase === 'goal' ? t('record.goalReached') : t('record.max')}
          </AppText>
        </View>
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wave}>
        {levels.map((level, index) => (
          <View
            key={index}
            style={[styles.bar, { height: 8 + level * 48, backgroundColor: theme.accent, opacity: 0.45 + level * 0.55 }]}
          />
        ))}
      </View>

      <AppText tone="secondary" style={styles.center}>
        {phase === 'before' ? t('record.tipBefore') : phase === 'goal' ? t('record.tipGoal') : t('record.tipMax')}
      </AppText>

      <Spacer />

      <View style={styles.actions}>
        <PrimaryButton label={t('record.done')} icon="check" large onPress={() => void finish()} />
        {/* Como a seta de voltar: depois de 3 s, pergunta antes de descartar. */}
        <LinkButton label={t('common.cancel')} align="center" onPress={leave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginLeft: -10 },
  header: { gap: 6 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  liveDot: { width: 12, height: 12, borderRadius: 6 },
  ringArea: { alignSelf: 'center', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ringText: { position: 'absolute', alignItems: 'center', gap: 2 },
  clock: { fontSize: 52, lineHeight: 60 },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 60 },
  bar: { width: 6, borderRadius: 3 },
  center: { textAlign: 'center' },
  actions: { gap: 6 },
});
