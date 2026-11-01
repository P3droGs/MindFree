import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton, PrimaryButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObservatoryScreen } from '@/components/observatory';
import { PostCard } from '@/components/post-card';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useStartCapture } from '@/hooks/use-start-capture';
import { useT } from '@/i18n';
import { timeAgo } from '@/lib/dates';
import { formatMinutes, minutesOfDay } from '@/lib/time';
import { changePosts, deletePhoto, POST_LIFETIME_MS, usePosts } from '@/state/posts';
import { useSettings } from '@/state/settings';

/** Das horas da noite até o resumo da manhã. */
function quietHours(now: Date, nightMinutes: number, morningMinutes: number): boolean {
  const minutes = minutesOfDay(now);
  return nightMinutes > morningMinutes
    ? minutes >= nightMinutes || minutes < morningMinutes
    : minutes >= nightMinutes && minutes < morningMinutes;
}

export default function MuralRoute() {
  return (
    <SocialGate>
      <MuralScreen />
    </SocialGate>
  );
}

/** O mural: só as conquistas que cada um escolhe postar. Por enquanto, as suas (ficam no celular). */
function MuralScreen() {
  const router = useRouter();
  const t = useT();
  const now = useNow();
  const { record } = useStartCapture();
  const { settings, update } = useSettings();
  const posts = usePosts();
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  const sleeping = settings.muralSleeps && quietHours(now, settings.nightMinutes, settings.morningMinutes);
  const recent = posts.filter((post) => now.getTime() - post.createdAt < POST_LIFETIME_MS);
  const myName = settings.name.trim().split(' ')[0] || t('friends.you');
  const toggle = (id: string) => setReacted((current) => ({ ...current, [id]: !current[id] }));

  const remove = (id: string, photoUri: string) => {
    Alert.alert(t('mural.deleteTitle'), t('mural.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mural.delete'),
        style: 'destructive',
        onPress: () => {
          deletePhoto(photoUri);
          changePosts((current) => current.filter((post) => post.id !== id));
        },
      },
    ]);
  };

  return (
    <ObservatoryScreen>
      <View style={styles.top}>
        <BackButton onPress={() => router.back()} color={OBS.text} style={styles.back} />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.muralSleeps }}
          accessibilityLabel={t('mural.sleepToggle', { time: formatMinutes(settings.nightMinutes) })}
          onPress={() => update({ muralSleeps: !settings.muralSleeps })}
          style={({ pressed }) => [
            styles.moon,
            {
              backgroundColor: settings.muralSleeps ? OBS.gold : OBS.raised,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Icon name="moon" size={20} color={settings.muralSleeps ? OBS.ink : OBS.goldText} strokeWidth={2.3} />
        </Pressable>
      </View>
      <AppText variant="display" accessibilityRole="header" style={{ color: OBS.text }}>
        {t('mural.title')}
      </AppText>
      <View style={styles.sleepInfo}>
        <AppText variant="bodyStrong" style={{ color: settings.muralSleeps ? OBS.goldText : OBS.soft }}>
          {settings.muralSleeps
            ? t('mural.sleepsAt', { time: formatMinutes(settings.nightMinutes) })
            : t('mural.alwaysOpen')}
        </AppText>
        <AppText variant="caption" style={{ color: OBS.muted }}>
          {settings.muralSleeps
            ? t('mural.sleepHintOn', {
                night: formatMinutes(settings.nightMinutes),
                morning: formatMinutes(settings.morningMinutes),
              })
            : t('mural.sleepHintOff')}
        </AppText>
      </View>

      {sleeping ? (
        <View style={styles.sleeping}>
          <Svg width={120} height={110} viewBox="0 0 120 110">
            <Circle cx={60} cy={60} r={40} fill="#FFE7A8" />
            <Circle cx={76} cy={48} r={36} fill={OBS.background} />
            <Path d="M86 18 h12 l-12 14 h12" stroke={OBS.soft} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M100 2 h8 l-8 9 h8" stroke={OBS.faint} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <AppText variant="title" style={[styles.center, { color: OBS.text }]}>
            {t('mural.sleepingTitle')}
          </AppText>
          <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
            {t('mural.sleepingBody', { time: formatMinutes(settings.morningMinutes) })}
          </AppText>
          <PrimaryButton label={t('mural.sleepingAction')} icon="mic" onPress={record} />
        </View>
      ) : (
        <>
          {recent.map((post) => (
            <PostCard
              key={post.id}
              name={myName}
              initial={myName[0].toLocaleUpperCase()}
              color="#C7B8FF"
              when={timeAgo(t, post.createdAt, now.getTime())}
              task={post.taskTitle}
              caption={post.caption}
              photoUri={post.photoUri}
              shines={0}
              shinedBy=""
              reacted={!!reacted[post.id]}
              onReact={() => toggle(post.id)}
              onDelete={() => remove(post.id, post.photoUri)}
            />
          ))}
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
                {t('mural.empty')}
              </AppText>
            </View>
          ) : null}
          <AppText variant="caption" style={[styles.center, { color: OBS.faint }]}>
            {t('mural.footer')}
          </AppText>
        </>
      )}
    </ObservatoryScreen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { marginLeft: -10 },
  moon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sleepInfo: { gap: 2, marginTop: -8 },
  sleeping: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  empty: { paddingVertical: 24 },
  center: { textAlign: 'center' },
});
