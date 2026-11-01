import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useT } from '@/i18n';
import { formatMinutes } from '@/lib/time';
import type { Task } from '@/state/journal';
import { useAppTheme } from '@/theme/theme-provider';

/** Uma tarefa: marcar como feita, o título (riscado quando feita) e o horário, que abre a edição. */
export function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const time = task.minutes === null ? t('task.setTime') : formatMinutes(task.minutes);
  const android = Platform.OS === 'android';

  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.cardShadow }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={(task.done ? t('widget.uncheck') : t('widget.check')).replace('{title}', task.title)}
        hitSlop={6}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        style={styles.checkArea}>
        <View
          style={[
            styles.check,
            android ? styles.square : styles.round,
            task.done
              ? { backgroundColor: theme.accentStrong, borderColor: theme.accentStrong }
              : { borderColor: theme.accentStrong },
          ]}>
          {task.done ? <Icon name="check" size={14} color={theme.dark ? theme.background : '#FFFFFF'} strokeWidth={3.4} /> : null}
        </View>
      </Pressable>
      <View style={styles.text}>
        <AppText
          variant="bodyStrong"
          tone={task.done ? 'secondary' : 'primary'}
          style={task.done && styles.doneTitle}>
          {task.title}
        </AppText>
        {task.note || task.example ? (
          <AppText variant="caption" tone="secondary">
            {[task.example ? t('example.label') : null, task.note].filter(Boolean).join(' · ')}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          task.minutes === null
            ? t('task.setTimeFor', { title: task.title })
            : t('task.changeTimeFor', { title: task.title, time })
        }
        hitSlop={4}
        onPress={() => router.push({ pathname: '/tarefa/[id]', params: { id: task.id } })}
        style={({ pressed }) => [styles.time, { backgroundColor: theme.raised, opacity: pressed ? 0.7 : 1 }]}>
        {task.reminder && task.minutes !== null ? null : <Icon name="bell-off" size={13} color={theme.textSecondary} />}
        <AppText variant="caption" style={styles.timeText}>
          {time}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  checkArea: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  check: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  round: { width: 26, height: 26, borderRadius: 13 },
  square: { width: 22, height: 22, borderRadius: 6 },
  text: { flex: 1, gap: 1 },
  doneTitle: { textDecorationLine: 'line-through' },
  time: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 12 },
  timeText: { fontVariant: ['tabular-nums'], fontFamily: 'Nunito_800ExtraBold' },
});
