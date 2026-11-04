import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { BackButton, PrimaryButton } from '@/components/buttons';
import { Icon } from '@/components/icon';
import { OBS, ObsChip, ObservatoryScreen, useObsToast } from '@/components/observatory';
import { PersonActionsSheet, type PersonAction } from '@/components/person-actions-sheet';
import { PostCard } from '@/components/post-card';
import { SocialGate } from '@/components/social-gate';
import { useNow } from '@/hooks/use-now';
import { useStartCapture } from '@/hooks/use-start-capture';
import { useT } from '@/i18n';
import { timeAgo } from '@/lib/dates';
import { mural, type CloudPost } from '@/lib/mural';
import { forget, remembered } from '@/lib/remembered';
import { displayName, failureText, initialOf, planetColor } from '@/lib/social';
import { formatMinutes, minutesOfDay } from '@/lib/time';
import { changePosts, deletePhoto, POST_LIFETIME_MS, usePosts, type Post } from '@/state/posts';
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

type Item = { at: number } & ({ kind: 'cloud'; post: CloudPost; local?: Post } | { kind: 'local'; post: Post });

/**
 * O mural: só as conquistas que cada um escolhe postar. Vêm da nuvem os seus posts e os de quem você segue
 * (7 dias). Os posts de antes do Mural na nuvem continuam só no seu celular, e só você vê.
 */
function MuralScreen() {
  const router = useRouter();
  const t = useT();
  const now = useNow();
  const { record } = useStartCapture();
  const { settings, update } = useSettings();
  const posts = usePosts();
  const [feed, setFeed] = useState<CloudPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<CloudPost | null>(null);
  const [toast, setToast] = useObsToast();
  const sleeping = settings.muralSleeps && quietHours(now, settings.nightMinutes, settings.morningMinutes);
  const myName = settings.name.trim().split(' ')[0] || t('friends.you');
  const nowMs = now.getTime();

  const load = useCallback(async (fresh = false) => {
    try {
      const next = await remembered('mural.feed', () => mural.feed(), fresh);
      setFeed(next);
      setFailed(false);
      // Os links valem 1 hora; lembrar por 30 s é seguro.
      setLinks(await remembered('mural.links', () => mural.photoLinks(next.map((post) => post.photoPath)), fresh));
    } catch {
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const localByCloud = new Map(posts.filter((post) => post.cloudId).map((post) => [post.cloudId, post]));
  const items: Item[] = [
    ...(feed ?? []).map((post): Item => ({
      kind: 'cloud',
      post,
      local: localByCloud.get(post.id),
      at: Date.parse(post.createdAt),
    })),
    ...posts.filter((post) => !post.cloudId).map((post): Item => ({ kind: 'local', post, at: post.createdAt })),
  ]
    .filter((item) => nowMs - item.at < POST_LIFETIME_MS)
    .sort((a, b) => b.at - a.at);

  const shinedBy = (post: CloudPost) => {
    if (post.shinedBy.length === 0) return '';
    const extra = post.shines - post.shinedBy.length;
    return extra > 0 ? `${post.shinedBy.join(', ')} ${t('mural.andMore', { count: extra })}` : post.shinedBy.join(', ');
  };

  const setShined = (id: string, on: boolean) =>
    setFeed((current) => current?.map((post) => (post.id === id ? { ...post, iShined: on } : post)) ?? null);

  const toggleShine = async (post: CloudPost) => {
    const on = !post.iShined;
    setShined(post.id, on);
    try {
      await mural.shine(post.id, on);
      forget('mural.');
    } catch (error) {
      setShined(post.id, !on);
      setToast(error instanceof Error && error.message === 'too_many' ? failureText(error, t) : t('mural.shineFailed'));
    }
  };

  const forgetLocal = (local: Post | undefined) => {
    if (!local) return;
    deletePhoto(local.photoUri);
    changePosts((current) => current.filter((post) => post.id !== local.id));
  };

  const remove = (item: Item) => {
    Alert.alert(t('mural.deleteTitle'), t('mural.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mural.delete'),
        style: 'destructive',
        onPress: async () => {
          if (item.kind === 'local') return forgetLocal(item.post);
          try {
            await mural.remove(item.post.id);
            forget('mural.');
          } catch {
            setToast(t('mural.deleteFailed'));
            return;
          }
          setFeed((current) => current?.filter((post) => post.id !== item.post.id) ?? null);
          forgetLocal(item.local);
        },
      },
    ]);
  };

  const afterAction = (action: PersonAction) => {
    const author = acting?.authorId;
    setActing(null);
    const text: Record<PersonAction, string> = {
      removed: t('safety.removed'),
      blocked: t('safety.blocked'),
      reported: t('safety.reported'),
      failed: t('social.offline'),
    };
    setToast(text[action]);
    if (action !== 'failed') forget();
    if (action === 'blocked') setFeed((current) => current?.filter((post) => post.authorId !== author) ?? null);
  };

  return (
    <ObservatoryScreen toast={toast}>
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
          {items.map((item) => {
            const when = timeAgo(t, item.at, nowMs);
            if (item.kind === 'local') {
              return (
                <PostCard
                  key={item.post.id}
                  name={myName}
                  initial={myName[0].toLocaleUpperCase()}
                  color="#C7B8FF"
                  when={when}
                  note={t('mural.onlyYou')}
                  task={item.post.taskTitle}
                  caption={item.post.caption}
                  photoUri={item.post.photoUri}
                  shines={0}
                  shinedBy=""
                  reacted={false}
                  onDelete={() => remove(item)}
                />
              );
            }
            const { post, local } = item;
            return (
              <PostCard
                key={post.id}
                name={post.mine ? myName : displayName(post)}
                initial={post.mine ? myName[0].toLocaleUpperCase() : initialOf(post)}
                color={post.mine ? '#C7B8FF' : planetColor(post.authorId)}
                when={when}
                task={post.taskTitle}
                caption={post.caption}
                photoUri={local?.photoUri ?? links[post.photoPath] ?? ''}
                cacheKey={local ? undefined : `mural-${post.id}`}
                shines={post.shines}
                shinedBy={shinedBy(post)}
                reacted={post.iShined}
                onReact={post.mine ? undefined : () => void toggleShine(post)}
                onDelete={post.mine ? () => remove(item) : undefined}
                onMore={post.mine ? undefined : () => setActing(post)}
              />
            );
          })}
          {failed ? (
            <View style={styles.failed}>
              <AppText variant="small" style={[styles.center, { color: OBS.soft }]}>
                {t('mural.loadFailed')}
              </AppText>
              <ObsChip label={t('social.retry')} onPress={() => void load(true)} />
            </View>
          ) : null}
          {items.length === 0 && feed && !failed ? (
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
      <PersonActionsSheet
        person={acting ? { userId: acting.authorId, handle: acting.handle, name: acting.name } : null}
        canRemove={false}
        postId={acting?.id}
        onClose={() => setActing(null)}
        onDone={afterAction}
      />
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
  failed: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  center: { textAlign: 'center' },
});
