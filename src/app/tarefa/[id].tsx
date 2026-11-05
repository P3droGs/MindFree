import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton, LinkButton, PrimaryButton } from '@/components/buttons';
import { Screen, Spacer } from '@/components/screen';
import { TimeStepper } from '@/components/time-stepper';
import { useNow } from '@/hooks/use-now';
import { useT } from '@/i18n';
import { weekdayName } from '@/lib/dates';
import { formatMinutes } from '@/lib/time';
import { addDays, dateFromKey, dayKey, removeTask, updateTask } from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

const TIMES = [8, 9, 10, 12, 14, 18, 20].map((hour) => hour * 60);

/** Mudar o dia, o horário ou o lembrete de uma tarefa (ou apagar). */
export default function EditTaskScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journal, change } = useJournal();
  const task = journal.tasks.find((candidate) => candidate.id === id);
  const today = dayKey(useNow());
  const [title, setTitle] = useState(task?.title ?? '');
  const [day, setDay] = useState(task && task.day >= today ? task.day : today);
  const [minutes, setMinutes] = useState(task?.minutes ?? 9 * 60);
  const [noReminder, setNoReminder] = useState(task ? !task.reminder || task.minutes === null : false);
  const [custom, setCustom] = useState(task?.minutes != null && !TIMES.includes(task.minutes));

  if (!task) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} style={styles.back} />
        <AppText variant="title">{t('task.missing')}</AppText>
      </Screen>
    );
  }

  const days = [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  if (!days.includes(day)) days.push(day);
  const dayLabel = (key: string) => {
    if (key === today) return t('date.today');
    if (key === addDays(today, 1)) return t('date.tomorrow');
    const date = dateFromKey(key);
    const name = weekdayName(t, date.getDay());
    return `${name.charAt(0).toLocaleUpperCase() + name.slice(1)} ${date.getDate()}`;
  };

  const save = () => {
    change((current) =>
      updateTask(current, task.id, {
        title: title.trim() || task.title,
        day,
        minutes: noReminder && task.minutes === null ? null : minutes,
        reminder: !noReminder,
      }),
    );
    router.back();
  };

  const remove = () => {
    Alert.alert(t('task.deleteTitle'), t('task.deleteBody', { title: task.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('task.delete'),
        style: 'destructive',
        onPress: () => {
          change((current) => removeTask(current, task.id));
          router.back();
        },
      },
    ]);
  };

  const chip = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected ? theme.accent : theme.surface,
      borderColor: selected ? theme.accent : theme.border,
    },
  ];

  return (
    <Screen>
      <BackButton onPress={() => router.back()} style={styles.back} />
      <View style={styles.intro}>
        <AppText variant="label" tone="secondary">
          {t('task.edit')}
        </AppText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t('task.titleLabel')}
          multiline
          style={[styles.title, { color: theme.text }]}
        />
        {task.note ? <AppText tone="secondary">{task.note}</AppText> : null}
      </View>

      <View style={styles.section}>
        <AppText variant="heading">{t('task.when')}</AppText>
        <View style={styles.chips}>
          {days.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: key === day }}
              onPress={() => setDay(key)}
              style={chip(key === day)}>
              <AppText variant="bodyStrong" style={{ color: key === day ? theme.onAccent : theme.text }}>
                {dayLabel(key)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* As horas ficam sempre vivas: quem entrou por "Pôr horário" numa tarefa sem lembrete escolhe a hora
          direto, e o lembrete liga sozinho. (Antes, os chips vinham desabilitados e o primeiro toque se perdia.) */}
      <View style={styles.section}>
        <AppText variant="heading">{t('task.whatTime')}</AppText>
        <View style={styles.chips}>
          {TIMES.map((value) => {
            const selected = !noReminder && !custom && value === minutes;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  setNoReminder(false);
                  setCustom(false);
                  setMinutes(value);
                }}
                style={chip(selected)}>
                <AppText variant="bodyStrong" style={{ color: selected ? theme.onAccent : theme.text }}>
                  {formatMinutes(value)}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: custom && !noReminder }}
            onPress={() => {
              setNoReminder(false);
              setCustom(true);
            }}
            style={chip(custom && !noReminder)}>
            <AppText variant="bodyStrong" style={{ color: custom && !noReminder ? theme.onAccent : theme.text }}>
              {t('task.otherTime')}
            </AppText>
          </Pressable>
        </View>
        {custom && !noReminder ? (
          <TimeStepper label={t('task.whatTime')} minutes={minutes} onChange={setMinutes} />
        ) : null}
      </View>

      <View style={[styles.switchRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {t('task.noReminder')}
        </AppText>
        <Switch
          value={noReminder}
          onValueChange={setNoReminder}
          accessibilityLabel={t('task.noReminder')}
          trackColor={{ true: theme.accent, false: theme.raised }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Spacer />
      <View style={styles.actions}>
        <PrimaryButton label={t('common.save')} onPress={save} />
        <LinkButton label={t('task.delete')} tone="danger" align="center" onPress={remove} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { marginLeft: -10 },
  intro: { gap: 6 },
  title: { fontFamily: fonts.extraBold, fontSize: 28, lineHeight: 34, padding: 0 },
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  actions: { gap: 6 },
});
