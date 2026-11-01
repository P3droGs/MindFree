import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { LinkButton, OutlineButton, PrimaryButton } from '@/components/buttons';
import { Card } from '@/components/card';
import { HomeHeader } from '@/components/home-header';
import { PendingNights } from '@/components/pending-nights';
import { Icon } from '@/components/icon';
import { RecordingPlayer } from '@/components/recording-player';
import { Screen, Spacer } from '@/components/screen';
import { SkyPreview } from '@/components/sky-preview';
import { TaskRow } from '@/components/task-row';
import { useNow } from '@/hooks/use-now';
import { useStartCapture } from '@/hooks/use-start-capture';
import { useT, type Translate } from '@/i18n';
import { eveningDay, manualTask } from '@/lib/capture';
import { dayTitle, monthName } from '@/lib/dates';
import { formatMinutes, greetingKey, isNight } from '@/lib/time';
import {
  addDays,
  addTasks,
  dayKey,
  nightOfDay,
  setTaskDone,
  starsInMonth,
  tasksOfDay,
  type Journal,
} from '@/state/journal';
import { useJournal } from '@/state/journal-provider';
import { useSettings } from '@/state/settings';
import { useAppTheme } from '@/theme/theme-provider';
import { fonts } from '@/theme/typography';

export default function HomeScreen() {
  const now = useNow();
  const { settings } = useSettings();
  const router = useRouter();
  const capture = useStartCapture();
  const { start } = useLocalSearchParams<{ start?: string }>();

  // O botão "Esvaziar a mente" do widget abre mindfree://?start=gravar: começa a gravar pelo mesmo caminho do
  // botão grande (com o consentimento antes, se faltar), e o voltar da gravação cai aqui no início.
  // Com o foco na tela, a navegação já está pronta (abrindo o app do zero, um efeito comum chega cedo demais).
  useFocusEffect(
    useCallback(() => {
      if (start !== 'gravar') return;
      router.setParams({ start: undefined });
      capture.record();
    }, [start, router, capture]),
  );

  return isNight(now, settings.morningMinutes) ? <NightHome now={now} /> : <DayHome now={now} />;
}

function greetingText(t: Translate, now: Date, name: string): string {
  const firstName = name.trim().split(' ')[0];
  const greeting = t(greetingKey(now));
  return firstName ? t('greeting.named', { greeting, name: firstName }) : t('greeting.plain', { greeting });
}

function skySubtitle(t: Translate, journal: Journal, now: Date, morningMinutes: number, night: boolean): string {
  const evening = eveningDay(now, morningMinutes);
  const stars = starsInMonth(journal, now);
  if (night && !nightOfDay(journal, evening)) {
    return stars === 0 ? t('home.skyNight') : t('widget.skyTonight', { n: stars + 1 });
  }
  if (stars === 0) return t('home.skyDay');
  const month = monthName(t, now.getMonth());
  return stars === 1 ? t('widget.starsOne', { month }) : t('widget.starsMany', { n: stars, month });
}

/** À noite: o céu, o que foi feito hoje e o convite para esvaziar a mente. */
function NightHome({ now }: { now: Date }) {
  const router = useRouter();
  const capture = useStartCapture();
  const theme = useAppTheme();
  const t = useT();
  const { settings } = useSettings();
  const { journal } = useJournal();
  const evening = eveningDay(now, settings.morningMinutes);
  const doneToday = tasksOfDay(journal, evening).filter((task) => task.done);
  const litTonight = !!nightOfDay(journal, evening);

  return (
    <Screen>
      <HomeHeader />

      <View style={styles.greeting}>
        <AppText variant="display" accessibilityRole="header">
          {greetingText(t, now, settings.name)}
        </AppText>
        <AppText tone="secondary">{t('home.nightLine')}</AppText>
      </View>

      <SkyPreview
        title={t('home.sky')}
        subtitle={skySubtitle(t, journal, now, settings.morningMinutes, true)}
        stars={starsInMonth(journal, now)}
        onPress={() => router.push('/ceu')}
      />

      <PendingNights />

      <Card>
        <View style={styles.cardHeader}>
          <AppText variant="heading">{t('home.day')}</AppText>
          <LinkButton label={t('home.seeCalendar')} onPress={() => router.push('/calendario')} />
        </View>
        <AppText variant="small" tone="secondary">
          {doneToday.length === 0
            ? t('home.noneDoneToday')
            : doneToday.length === 1
              ? t('home.doneTodayOne')
              : t('home.doneTodayMany', { n: doneToday.length })}
        </AppText>
        {doneToday.slice(0, 3).map((task) => (
          <View key={task.id} style={styles.doneRow}>
            <View style={[styles.doneCheck, { backgroundColor: theme.accent }]}>
              <Icon name="check" size={13} color={theme.onAccent} strokeWidth={3} />
            </View>
            <AppText variant="bodyStrong" style={styles.flex}>
              {task.title}
            </AppText>
            {task.minutes !== null ? (
              <AppText variant="caption" tone="secondary">
                {formatMinutes(task.minutes)}
              </AppText>
            ) : null}
          </View>
        ))}
      </Card>

      <Spacer />

      <View style={styles.actions}>
        <PrimaryButton label={t('home.record')} icon="mic" large onPress={capture.record} />
        <AppText variant="small" tone="secondary" style={styles.center}>
          {litTonight ? t('home.litTonight') : t('home.recordHint')}
        </AppText>
        <LinkButton label={t('home.writeInstead')} align="center" onPress={capture.write} />
      </View>
    </Screen>
  );
}

/** De dia: as tarefas organizadas, com lembretes, e o que ficou para os próximos dias. */
function DayHome({ now }: { now: Date }) {
  const router = useRouter();
  const capture = useStartCapture();
  const theme = useAppTheme();
  const t = useT();
  const { settings } = useSettings();
  const { journal, change } = useJournal();
  const [draft, setDraft] = useState('');
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const lastNight = nightOfDay(journal, addDays(today, -1));
  const days = [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDays(today, offset))
    .map((day) => ({ day, tasks: tasksOfDay(journal, day) }))
    .filter(({ day, tasks }) => day === today || tasks.length > 0);
  const hasExamples = journal.tasks.some((task) => task.example);

  const toggle = (id: string, done: boolean) => change((current) => setTaskDone(current, id, !done));
  const addDraft = () => {
    const title = draft.trim();
    if (!title) return;
    change((current) => addTasks(current, [manualTask(title, today)]));
    setDraft('');
  };

  let summary = t('home.dayEmptySummary', { time: formatMinutes(settings.nightMinutes) });
  if (lastNight) {
    summary =
      lastNight.noted === 1
        ? t('home.lastNightOne')
        : t('home.lastNightMany', { n: lastNight.noted });
  }

  return (
    <Screen>
      <HomeHeader />

      <View style={styles.greeting}>
        <AppText variant="display" accessibilityRole="header">
          {greetingText(t, now, settings.name)}
        </AppText>
        <AppText tone="secondary">{summary}</AppText>
      </View>

      <PendingNights />

      {days.map(({ day, tasks }) => (
        <View key={day} style={styles.section}>
          <AppText variant="label" tone="secondary" accessibilityRole="header">
            {dayTitle(t, day, today, tomorrow)}
          </AppText>
          {tasks.length === 0 ? (
            <AppText variant="small" tone="secondary">
              {t('home.nothingToday')}
            </AppText>
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggle(task.id, task.done)} />)
          )}
        </View>
      ))}

      {lastNight?.audioUri ? <RecordingPlayer uri={lastNight.audioUri} /> : null}
      {lastNight?.transcript ? <Transcript text={lastNight.transcript} /> : null}

      <View style={styles.section}>
        <AppText variant="bodyStrong">{t('home.missing')}</AppText>
        <View style={[styles.addRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addDraft}
            placeholder={t('home.addPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('home.addPlaceholder')}
            returnKeyType="done"
            style={[styles.addInput, { color: theme.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.addTask')}
            onPress={addDraft}
            style={({ pressed }) => [styles.addButton, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name="plus" size={20} color={theme.onAccent} strokeWidth={2.6} />
          </Pressable>
        </View>
        <OutlineButton label={t('home.recordNow')} icon="mic" onPress={capture.record} />
        <LinkButton label={t('home.writeInstead')} align="center" onPress={capture.write} />
      </View>

      <SkyPreview
        title={t('home.sky')}
        subtitle={skySubtitle(t, journal, now, settings.morningMinutes, false)}
        stars={starsInMonth(journal, now)}
        onPress={() => router.push('/ceu')}
      />

      {hasExamples ? (
        <Card>
          <AppText variant="small" tone="secondary">
            {t('example.notice')}
          </AppText>
          <LinkButton
            label={t('example.clear')}
            tone="danger"
            onPress={() =>
              change((current) => ({
                tasks: current.tasks.filter((task) => !task.example),
                nights: current.nights,
              }))
            }
          />
        </Card>
      ) : null}

      <AppText variant="small" tone="secondary" style={styles.center}>
        {t('home.callAgain', { time: formatMinutes(settings.nightMinutes) })}
      </AppText>
    </Screen>
  );
}

function Transcript({ text }: { text: string }) {
  const theme = useAppTheme();
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.transcript, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={styles.transcriptHeader}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {t('home.whatYouWrote')}
        </AppText>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color={theme.textSecondary} />
      </Pressable>
      {open ? (
        <AppText variant="small" tone="secondary">
          {`“${text}”`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  greeting: { gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: -6 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 8 },
  center: { textAlign: 'center' },
  section: { gap: 10 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, borderWidth: 1, paddingLeft: 16, paddingRight: 6 },
  addInput: { flex: 1, minHeight: 52, fontFamily: fonts.semiBold, fontSize: 16 },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  transcript: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  transcriptHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
});
