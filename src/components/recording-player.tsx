import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { useAppTheme } from '@/theme/theme-provider';

/** Ouvir de novo o que a pessoa falou à noite. */
export function RecordingPlayer({ uri }: { uri: string }) {
  const theme = useAppTheme();
  const t = useT();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const seconds = Math.round(status.duration || 0);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.2)) {
      void player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status.playing ? t('recording.pause') : t('recording.listen')}
      onPress={toggle}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.button, { backgroundColor: theme.accent }]}>
        <Icon name={status.playing ? 'pause' : 'play'} size={16} color={theme.onAccent} strokeWidth={2.6} />
      </View>
      <AppText variant="bodyStrong" style={styles.label}>
        {t('recording.yesterday')}
      </AppText>
      {seconds > 0 ? (
        <AppText variant="caption" tone="secondary">
          {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1 },
  button: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
