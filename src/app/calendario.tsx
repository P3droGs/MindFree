import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, IconButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TaskRow } from '@/components/task-row';
import { useNow } from '@/hooks/use-now';
import { useT, type MessageKey } from '@/i18n';
import { longDate, monthName } from '@/lib/dates';
import { formatMinutes } from '@/lib/time';
import { dayKey, nightOfDay, setTaskDone, tasksOfDay } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { useAppTheme } from '@/theme/theme-provider';
import { withAlpha } from '@/theme/color';

export default function CalendarScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { journal, change } = useJournal();
  const today = useNow();
  const todayKey = dayKey(today);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(todayKey);
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => dayKey(new Date(year, month, index + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayTasks = tasksOfDay(journal, selected);
  const done = dayTasks.filter((task) => task.done);
  const pending = dayTasks.filter((task) => !task.done);
  const night = nightOfDay(journal, selected);
  const isToday = selected === todayKey;
  const title = monthName(t, month);

  let summary = t('calendar.noneDone');
  if (done.length === 1) summary = t('calendar.doneOne');
  if (done.length > 1) summary = t('calendar.doneMany', { n: done.length });
  if (isToday) summary = `${t('date.today')} · ${summary}`;

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('calendar.title')}
        </AppText>
        <AppText tone="secondary">{t('calendar.sub')}</AppText>
      </View>

      <Card>
        <View style={styles.monthRow}>
          <IconButton icon="chevron-left" label={t('calendar.previous')} onPress={() => setOffset(offset - 1)} />
          <AppText variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite">
            {`${title.charAt(0).toLocaleUpperCase()}${title.slice(1)} ${year}`}
          </AppText>
          <IconButton icon="chevron-right" label={t('calendar.next')} onPress={() => setOffset(offset + 1)} />
        </View>
        <View style={styles.week}>
          {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
            <AppText key={weekday} variant="caption" tone="secondary" style={styles.weekday}>
              {t(`weekdayShort.${weekday}` as MessageKey)}
            </AppText>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((key, index) => {
            if (!key) return <View key={`vazio-${index}`} style={styles.cell} />;
            const tasks = tasksOfDay(journal, key);
            const doneCount = tasks.filter((task) => task.done).length;
            const lit = !!nightOfDay(journal, key);
            const isSelected = key === selected;
            const isCurrent = key === todayKey;
            const label = longDate(t, key);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={
                  doneCount === 0
                    ? label
                    : `${label}, ${doneCount === 1 ? t('calendar.doneOne') : t('calendar.doneMany', { n: doneCount })}`
                }
                onPress={() => setSelected(key)}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isSelected && { backgroundColor: theme.accent },
                    !isSelected && isCurrent && { borderColor: theme.text, borderWidth: 2 },
                    !isSelected && lit && { backgroundColor: withAlpha(theme.accent, 0.16) },
                  ]}>
                  <AppText variant="bodyStrong" style={{ color: isSelected ? theme.onAccent : theme.text }}>
                    {String(Number(key.slice(8)))}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.dot,
                    // Só os dias com tarefas concluídas ganham ponto, como diz a legenda.
                    { backgroundColor: doneCount > 0 ? theme.accentStrong : 'transparent' },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: theme.accentStrong }]} />
            <AppText variant="caption" tone="secondary" style={styles.legendText}>
              {t('calendar.legendDone')}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendNight, { backgroundColor: withAlpha(theme.accent, 0.16) }]} />
            <AppText variant="caption" tone="secondary" style={styles.legendText}>
              {t('calendar.legendNight')}
            </AppText>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {longDate(t, selected).replace(/^./, (letter) => letter.toLocaleUpperCase())}
        </AppText>
        <AppText variant="small" tone="secondary">
          {summary}
        </AppText>
        {night ? (
          <View style={[styles.night, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Icon name="moon" size={18} color={theme.accentStrong} strokeWidth={2.3} />
            <AppText variant="small" style={styles.flex}>
              {night.noted === 1
                ? t('calendar.nightOne', { time: formatMinutes(night.at) })
                : t('calendar.nightMany', { time: formatMinutes(night.at), n: night.noted })}
            </AppText>
          </View>
        ) : null}
        {done.length > 0 ? (
          <>
            <AppText variant="label" tone="secondary">
              {t('calendar.whatYouDid')}
            </AppText>
            {done.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => change((current) => setTaskDone(current, task.id, false))} />
            ))}
          </>
        ) : null}
        {pending.length > 0 ? (
          <>
            <AppText variant="label" tone="secondary">
              {t('calendar.toDo')}
            </AppText>
            {pending.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={() => change((current) => setTaskDone(current, task.id, true))} />
            ))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: -10 },
  intro: { gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -6 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2, gap: 2 },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  legendText: { flexShrink: 1 },
  legendNight: { width: 14, height: 14, borderRadius: 7 },
  section: { gap: 10 },
  night: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
});
